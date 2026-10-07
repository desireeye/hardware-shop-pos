import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeText = (value: string | null | undefined, maxLength = 200) => {
  if (value === null || value === undefined) return null;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return normalized.slice(0, maxLength);
};

const normalizePhone = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null;

  const sanitized = value.replace(/[^\d+]/g, '').trim();
  if (!sanitized) return null;

  const digitsOnly = sanitized.replace(/\+/g, '');
  const normalized = digitsOnly.length > 10 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;

  return normalized.length >= 7 ? normalized : null;
};

const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable().or(z.literal('')).transform((value) => value ?? null),
  address: z.string().trim().max(500).optional().nullable().or(z.literal('')).transform((value) => value ?? null),
});

const customerUpdateSchema = customerInputSchema.partial();

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const findPhoneConflict = async (phone: string | null, excludeId?: string) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  const customers = await prisma.customer.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });

  return customers.find((customer) => normalizePhone(customer.phone) === normalizedPhone && customer.id !== excludeId) ?? null;
};

const getCustomerStats = async (id: string) => {
  const [completedOrders, latestOrder] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id, orderStatus: 'COMPLETED' },
      select: { id: true, grandTotal: true, createdAt: true, invoiceNumber: true, orderStatus: true, paymentStatus: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findFirst({
      where: { customerId: id, orderStatus: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const totalPurchases = completedOrders.reduce((sum, order) => sum + toNumber(order.grandTotal), 0);

  return {
    totalOrders: completedOrders.length,
    totalPurchases,
    lastPurchaseAt: latestOrder?.createdAt ?? null,
    recentOrders: completedOrders,
  };
};

const serializeCustomer = (customer: any) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const page = clamp(Number(req.query.page ?? 1), 1, 1000);
  const pageSize = clamp(Number(req.query.pageSize ?? 20), 1, 100);
  const search = String(req.query.search ?? '').trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const enrichedCustomers = await Promise.all(
    customers.map(async (customer) => {
      const stats = await getCustomerStats(customer.id);
      return {
        ...serializeCustomer(customer),
        totalOrders: stats.totalOrders,
        totalPurchases: stats.totalPurchases,
        lastPurchaseAt: stats.lastPurchaseAt,
      };
    }),
  );

  return res.status(200).json({
    success: true,
    customers: enrichedCustomers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = customerInputSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid customer data.',
      errorCode: 'INVALID_CUSTOMER_DATA',
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const sanitisedName = normalizeText(payload.name, 120);
  const sanitisedPhone = normalizePhone(payload.phone);
  const sanitisedAddress = normalizeText(payload.address, 500);

  if (!sanitisedName) {
    return res.status(400).json({ success: false, message: 'Customer name is required.', errorCode: 'INVALID_CUSTOMER_DATA' });
  }

  if (payload.phone && payload.phone.trim() && !/^[+0-9\s().-]{7,30}$/.test(payload.phone.trim())) {
    return res.status(400).json({ success: false, message: 'Phone number is invalid.', errorCode: 'INVALID_CUSTOMER_DATA' });
  }

  const conflict = await findPhoneConflict(sanitisedPhone);
  if (conflict) {
    return res.status(409).json({
      success: false,
      message: 'A customer with the same phone number already exists.',
      errorCode: 'CUSTOMER_PHONE_CONFLICT',
      existingCustomerId: conflict.id,
    });
  }

  const customer = await prisma.customer.create({
    data: {
      name: sanitisedName,
      phone: sanitisedPhone,
      address: sanitisedAddress,
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Customer created.',
    customer: serializeCustomer(customer),
  });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found.', errorCode: 'CUSTOMER_NOT_FOUND' });
  }

  const stats = await getCustomerStats(id);

  const purchaseHistory = await prisma.order.findMany({
    where: { customerId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      grandTotal: true,
      paymentStatus: true,
      orderStatus: true,
      payments: { select: { paymentMethod: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return res.status(200).json({
    success: true,
    customer: {
      ...serializeCustomer(customer),
      totalOrders: stats.totalOrders,
      totalPurchases: stats.totalPurchases,
      lastPurchaseAt: stats.lastPurchaseAt,
    },
    purchaseHistory: purchaseHistory.map((entry) => ({
      id: entry.id,
      invoiceNumber: entry.invoiceNumber,
      createdAt: entry.createdAt,
      total: toNumber(entry.grandTotal),
      paymentStatus: entry.paymentStatus,
      orderStatus: entry.orderStatus,
      paymentMethod: entry.payments[0]?.paymentMethod ?? null,
    })),
  });
});

router.get('/:id/orders', requireAuth, async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const page = clamp(Number(req.query.page ?? 1), 1, 1000);
  const pageSize = clamp(Number(req.query.pageSize ?? 20), 1, 100);
  const fromDate = req.query.fromDate ? new Date(String(req.query.fromDate)) : undefined;
  const toDate = req.query.toDate ? new Date(String(req.query.toDate)) : undefined;

  const customerExists = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customerExists) {
    return res.status(404).json({ success: false, message: 'Customer not found.', errorCode: 'CUSTOMER_NOT_FOUND' });
  }

  const where: Prisma.OrderWhereInput = {
    customerId: id,
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: new Date(new Date(String(toDate)).getFullYear(), new Date(String(toDate)).getMonth(), new Date(String(toDate)).getDate(), 23, 59, 59, 999) } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        grandTotal: true,
        paymentStatus: true,
        orderStatus: true,
        payments: { select: { paymentMethod: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    orders: orders.map((entry) => ({
      id: entry.id,
      invoiceNumber: entry.invoiceNumber,
      date: entry.createdAt,
      total: toNumber(entry.grandTotal),
      paymentStatus: entry.paymentStatus,
      orderStatus: entry.orderStatus,
      paymentMethod: entry.payments[0]?.paymentMethod ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const parsed = customerUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid customer data.',
      errorCode: 'INVALID_CUSTOMER_DATA',
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Customer not found.', errorCode: 'CUSTOMER_NOT_FOUND' });
  }

  const nextName = payload.name !== undefined ? normalizeText(payload.name, 120) : existing.name;
  const nextPhone = payload.phone !== undefined ? normalizePhone(payload.phone) : normalizePhone(existing.phone);
  const nextAddress = payload.address !== undefined ? normalizeText(payload.address, 500) : normalizeText(existing.address, 500);

  if (!nextName || !nextName.trim()) {
    return res.status(400).json({ success: false, message: 'Customer name is required.', errorCode: 'INVALID_CUSTOMER_DATA' });
  }

  if (payload.phone !== undefined && payload.phone !== null && payload.phone.trim() && !/^[+0-9\s().-]{7,30}$/.test(payload.phone.trim())) {
    return res.status(400).json({ success: false, message: 'Phone number is invalid.', errorCode: 'INVALID_CUSTOMER_DATA' });
  }

  const conflict = await findPhoneConflict(nextPhone, id);
  if (conflict) {
    return res.status(409).json({
      success: false,
      message: 'Another customer already uses this phone number.',
      errorCode: 'CUSTOMER_PHONE_CONFLICT',
      existingCustomerId: conflict.id,
    });
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: {
      name: nextName,
      phone: nextPhone,
      address: nextAddress,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Customer updated.',
    customer: serializeCustomer(updatedCustomer),
  });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found.', errorCode: 'CUSTOMER_NOT_FOUND' });
  }

  const orderExists = await prisma.order.findFirst({
    where: { customerId: id },
    select: { id: true },
  });

  if (orderExists) {
    return res.status(409).json({
      success: false,
      message: 'Customer cannot be deleted because order history exists.',
      errorCode: 'CUSTOMER_HAS_ORDERS',
    });
  }

  await prisma.customer.delete({ where: { id } });

  return res.status(200).json({
    success: true,
    message: `Customer ${customer.name} was deleted.`,
  });
});

export default router;

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { amountToWords } from '../utils/amountToWords.js';

const router = Router();

const paymentMethodValues = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'] as const;
const orderStatusValues = ['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toDateTime = (value: string | undefined, endOfDay = false) => {
  if (!value) return undefined;

  const match = /^\d{4}-\d{2}-\d{2}$/;
  if (!match.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;

  return endOfDay ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

const normalizeStatus = (value: string | undefined) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  if (orderStatusValues.includes(upper as typeof orderStatusValues[number])) {
    return upper as typeof orderStatusValues[number];
  }
  return undefined;
};

const normalizePaymentMethod = (value: string | undefined) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  if (paymentMethodValues.includes(upper as typeof paymentMethodValues[number])) {
    return upper as typeof paymentMethodValues[number];
  }
  return undefined;
};

const getShopSetting = async (key: string, fallback: string) => {
  const result = await prisma.setting.findUnique({ where: { key } });
  return result?.value ?? fallback;
};

const getInvoiceSettings = async () => {
  const [shopName, shopAddress, shopPhone, shopEmail, shopGstin, invoiceFooter, returnPolicy] = await Promise.all([
    getShopSetting('shop_name', 'Hardware Shop'),
    getShopSetting('shop_address', '123 Main Road, Market Area'),
    getShopSetting('shop_phone', 'XXXXX XXXXX'),
    getShopSetting('shop_email', 'sales@hardwareshop.local'),
    getShopSetting('shop_gstin', 'GSTIN: XXXXX'),
    getShopSetting('invoice_footer', 'Thank you for shopping with us.'),
    getShopSetting('return_policy', 'Returns accepted within 7 days with valid proof of purchase.'),
  ]);

  return {
    shopName,
    shopAddress,
    shopPhone,
    shopEmail,
    shopGstin,
    invoiceFooter,
    returnPolicy,
  };
};

const serializeOrderSummary = (order: any) => ({
  id: order.id,
  invoiceNumber: order.invoiceNumber,
  createdAt: order.createdAt,
  customerName: order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
  customerPhone: order.customerPhoneSnapshot || order.customer?.phone || null,
  orderStatus: order.orderStatus,
  paymentStatus: order.paymentStatus,
  grandTotal: toNumber(order.grandTotal),
  itemCount: order.orderItems?.length ?? 0,
  cashierName: order.user?.name || 'Unknown',
  paymentMethod: order.payments?.[0]?.paymentMethod ?? null,
});

const serializeInvoice = (order: any, shopSettings: Awaited<ReturnType<typeof getInvoiceSettings>>) => ({
  id: order.id,
  invoiceNumber: order.invoiceNumber,
  orderStatus: order.orderStatus,
  paymentStatus: order.paymentStatus,
  createdAt: order.createdAt,
  customer: {
    name: order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
    phone: order.customerPhoneSnapshot || order.customer?.phone || null,
    address: order.customerAddressSnapshot || order.customer?.address || null,
    email: order.customerEmailSnapshot || order.customer?.email || null,
  },
  cashier: {
    id: order.user?.id || null,
    name: order.user?.name || 'Unknown',
  },
  payment: order.payments && order.payments.length > 0
    ? {
        method: order.payments[0].paymentMethod,
        amount: toNumber(order.payments[0].amount),
        status: order.payments[0].status,
        referenceNo: order.payments[0].referenceNo || null,
      }
    : {
        method: 'N/A',
        amount: 0,
        status: 'PENDING',
        referenceNo: null,
      },
  items: order.orderItems.map((item: any, index: number) => ({
    serialNo: index + 1,
    id: item.id,
    productName: item.productNameSnapshot || 'Unknown Item',
    sku: item.skuSnapshot || '-',
    quantity: item.quantity,
    rate: toNumber(item.actualUnitPrice),
    discount: toNumber(item.discount),
    gstRate: toNumber(item.gstRate),
    taxableAmount: toNumber(item.taxableAmount),
    taxAmount: toNumber(item.taxAmount),
    lineTotal: toNumber(item.lineTotal),
  })),
  subtotal: toNumber(order.subtotal),
  discount: toNumber(order.discount),
  taxableAmount: toNumber(order.taxableAmount),
  cgst: toNumber(order.cgst),
  sgst: toNumber(order.sgst),
  igst: toNumber(order.igst),
  grandTotal: toNumber(order.grandTotal),
  amountInWords: amountToWords(toNumber(order.grandTotal) ?? 0),
  shop: {
    name: shopSettings.shopName,
    address: shopSettings.shopAddress,
    phone: shopSettings.shopPhone,
    email: shopSettings.shopEmail,
    gstin: shopSettings.shopGstin,
    footer: shopSettings.invoiceFooter,
    returnPolicy: shopSettings.returnPolicy,
  },
});

router.get('/orders', requireAuth, async (req, res) => {
  const queryResult = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().default(''),
    status: z.string().trim().default('ALL'),
    paymentMethod: z.string().trim().default('ALL'),
    customerId: z.string().trim().default(''),
    fromDate: z.string().trim().default(''),
    toDate: z.string().trim().default(''),
  }).safeParse(req.query);

  if (!queryResult.success) {
    return res.status(400).json({
      success: false,
      message: queryResult.error.issues[0]?.message ?? 'Invalid order filter parameters.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { page, pageSize, search, status, paymentMethod, customerId, fromDate, toDate } = queryResult.data;
  const normalizedStatus = normalizeStatus(status);
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const from = toDateTime(fromDate);
  const to = toDateTime(toDate, true);

  if ((fromDate && !from) || (toDate && !to)) {
    return res.status(400).json({
      success: false,
      message: 'Date filter must use YYYY-MM-DD format.',
      errorCode: 'INVALID_DATE',
    });
  }

  if (from && to && from.getTime() > to.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'From date cannot be later than to date.',
      errorCode: 'INVALID_DATE_RANGE',
    });
  }

  const searchTerm = search.trim();
  const where: Prisma.OrderWhereInput = {
    ...(customerId ? { customerId } : {}),
    ...(normalizedStatus ? { orderStatus: normalizedStatus } : {}),
    ...(normalizedPaymentMethod ? { payments: { some: { paymentMethod: normalizedPaymentMethod } } } : {}),
    ...(searchTerm
      ? {
          OR: [
            { invoiceNumber: { contains: searchTerm, mode: 'insensitive' as const } },
            { customerNameSnapshot: { contains: searchTerm, mode: 'insensitive' as const } },
            { customerPhoneSnapshot: { contains: searchTerm, mode: 'insensitive' as const } },
            { user: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
            { orderItems: { some: { productNameSnapshot: { contains: searchTerm, mode: 'insensitive' as const } } } },
            { orderItems: { some: { skuSnapshot: { contains: searchTerm, mode: 'insensitive' as const } } } },
            { orderItems: { some: { product: { OR: [{ name: { contains: searchTerm, mode: 'insensitive' as const } }, { sku: { contains: searchTerm, mode: 'insensitive' as const } }, { barcode: { contains: searchTerm, mode: 'insensitive' as const } }] } } } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: true, customer: true, orderItems: true, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    orders: orders.map(serializeOrderSummary),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true, customer: true, orderItems: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { createdAt: 'desc' } } },
  });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.', errorCode: 'ORDER_NOT_FOUND' });
  }

  return res.status(200).json({
    success: true,
    order: {
      ...serializeOrderSummary(order),
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      taxableAmount: toNumber(order.taxableAmount),
      cgst: toNumber(order.cgst),
      sgst: toNumber(order.sgst),
      igst: toNumber(order.igst),
      customer: {
        id: order.customer?.id ?? null,
        name: order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
        phone: order.customerPhoneSnapshot || order.customer?.phone || null,
        address: order.customerAddressSnapshot || order.customer?.address || null,
        email: order.customerEmailSnapshot || order.customer?.email || null,
      },
      items: order.orderItems.map((item: any) => ({
        ...item,
        actualUnitPrice: toNumber(item.actualUnitPrice),
        originalUnitPrice: toNumber(item.originalUnitPrice),
        discount: toNumber(item.discount),
        gstRate: toNumber(item.gstRate),
        taxableAmount: toNumber(item.taxableAmount),
        taxAmount: toNumber(item.taxAmount),
        lineTotal: toNumber(item.lineTotal),
      })),
      payment: order.payments?.[0]
        ? {
            id: order.payments[0].id,
            method: order.payments[0].paymentMethod,
            amount: toNumber(order.payments[0].amount),
            status: order.payments[0].status,
            referenceNo: order.payments[0].referenceNo,
          }
        : null,
    },
  });
});

const getInvoiceById = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true, customer: true, orderItems: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { createdAt: 'desc' } } },
  });

  if (!order) {
    return null;
  }

  return serializeInvoice(order, await getInvoiceSettings());
};

router.get('/orders/:id/invoice', requireAuth, async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const invoice = await getInvoiceById(id);

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found.', errorCode: 'INVOICE_NOT_FOUND' });
  }

  return res.status(200).json({
    success: true,
    invoice,
  });
});

router.get('/invoices/:id', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const invoice = await getInvoiceById(id);

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found.', errorCode: 'INVOICE_NOT_FOUND' });
  }

  return res.status(200).json({ success: true, invoice });
});

router.get('/settings/invoice', requireAuth, async (_req, res) => {
  const settings = await getInvoiceSettings();

  return res.status(200).json({ success: true, settings });
});

router.put('/settings/invoice', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const payload = z.object({
    shopName: z.string().trim().max(150).optional(),
    shopAddress: z.string().trim().max(300).optional(),
    shopPhone: z.string().trim().max(60).optional(),
    shopEmail: z.string().trim().max(150).optional(),
    shopGstin: z.string().trim().max(60).optional(),
    invoiceFooter: z.string().trim().max(300).optional(),
    returnPolicy: z.string().trim().max(300).optional(),
  }).parse(req.body);

  const keyMap: Record<string, string> = {
    shopName: 'shop_name',
    shopAddress: 'shop_address',
    shopPhone: 'shop_phone',
    shopEmail: 'shop_email',
    shopGstin: 'shop_gstin',
    invoiceFooter: 'invoice_footer',
    returnPolicy: 'return_policy',
  };

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;

    await prisma.setting.upsert({
      where: { key: keyMap[key] },
      update: { value: String(value) },
      create: { key: keyMap[key], value: String(value) },
    });
  }

  return res.status(200).json({ success: true, message: 'Invoice settings updated.' });
});

export default router;

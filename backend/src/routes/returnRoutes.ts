import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

const decimalFromNumber = (value: number) => new Prisma.Decimal(Number(value).toFixed(2));
const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const returnStatusValues = ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const;

const normalizeStatus = (value: string | undefined) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  if (returnStatusValues.includes(upper as typeof returnStatusValues[number])) {
    return upper as typeof returnStatusValues[number];
  }
  return undefined;
};

const toDateTime = (value: string | undefined, endOfDay = false) => {
  if (!value) return undefined;

  const match = /^\d{4}-\d{2}-\d{2}$/;
  if (!match.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;

  return endOfDay ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

const createReturnNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `RET-${y}${m}${d}-${random}`;
};

const serializeReturnItem = (item: any) => ({
  id: item.id,
  returnId: item.returnId,
  orderItemId: item.orderItemId,
  productId: item.productId,
  productName: item.product?.name ?? item.productNameSnapshot ?? 'Unknown Item',
  sku: item.product?.sku ?? '',
  quantity: item.quantity,
  unitRefundPrice: toNumber(item.unitRefundPrice),
  taxRefundAmount: toNumber(item.taxRefundAmount),
  refundAmount: toNumber(item.refundAmount),
  reason: item.reason ?? null,
  createdAt: item.createdAt,
});

const serializeReturn = (record: any) => ({
  id: record.id,
  returnNumber: record.returnNumber,
  originalOrderId: record.originalOrderId,
  orderInvoiceNumber: record.originalOrder?.invoiceNumber ?? null,
  customerId: record.customerId ?? null,
  customerName: record.customer?.name ?? record.originalOrder?.customerNameSnapshot ?? 'Walk-in Customer',
  refundMethod: record.refundMethod,
  refundAmount: toNumber(record.refundAmount),
  reason: record.reason ?? null,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  items: (record.returnItems ?? []).map(serializeReturnItem),
});

const returnItemSchema = z.object({
  orderItemId: z.string().trim().min(1, 'Order item is required'),
  quantity: z.coerce.number().int().min(1, 'Return quantity must be at least 1'),
  reason: z.string().trim().max(200).optional().or(z.literal('')).default(''),
});

const returnSchema = z.object({
  orderId: z.string().trim().min(1, 'Order is required'),
  refundMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  reason: z.string().trim().max(500).optional().or(z.literal('')).default(''),
  idempotencyKey: z.string().trim().min(1).max(120).optional().or(z.literal('')).default(''),
  items: z.array(returnItemSchema).min(1, 'At least one item is required for a return'),
});

router.get('/returns', requireAuth, async (req, res) => {
  const queryResult = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().default(''),
    status: z.string().trim().default('ALL'),
    fromDate: z.string().trim().default(''),
    toDate: z.string().trim().default(''),
  }).safeParse(req.query);

  if (!queryResult.success) {
    return res.status(400).json({
      success: false,
      message: queryResult.error.issues[0]?.message ?? 'Invalid return query parameters.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { page, pageSize, search, status, fromDate, toDate } = queryResult.data;
  const normalizedStatus = normalizeStatus(status);

  const from = toDateTime(fromDate);
  const to = toDateTime(toDate, true);

  if ((fromDate && !from) || (toDate && !to)) {
    return res.status(400).json({
      success: false,
      message: 'Date filters must use YYYY-MM-DD format.',
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
  const where: Prisma.ReturnWhereInput = {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(searchTerm ? {
      OR: [
        { returnNumber: { contains: searchTerm, mode: 'insensitive' as const } },
        { reason: { contains: searchTerm, mode: 'insensitive' as const } },
        { originalOrder: { invoiceNumber: { contains: searchTerm, mode: 'insensitive' as const } } },
        { customer: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
        { returnItems: { some: { product: { OR: [{ name: { contains: searchTerm, mode: 'insensitive' as const } }, { sku: { contains: searchTerm, mode: 'insensitive' as const } }] } } } },
      ],
    } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        originalOrder: true,
        customer: true,
        returnItems: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.return.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    returns: returns.map(serializeReturn),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.get('/orders/:id/returnable-items', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          product: true,
          returnItems: true,
        },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.', errorCode: 'ORDER_NOT_FOUND' });
  }

  if (order.orderStatus !== 'COMPLETED') {
    return res.status(400).json({
      success: false,
      message: 'Only completed orders can be returned.',
      errorCode: 'ORDER_NOT_ELIGIBLE_FOR_RETURN',
    });
  }

  const items = order.orderItems.map((item) => {
    const alreadyReturned = item.returnItems.reduce((sum, entry) => sum + entry.quantity, 0);
    const returnableQuantity = Math.max(0, item.quantity - alreadyReturned);

    return {
      id: item.id,
      orderItemId: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      returnableQuantity,
      unitPrice: toNumber(item.actualUnitPrice),
      gstRate: toNumber(item.gstRate),
      lineTotal: toNumber(item.lineTotal),
      refundAmount: toNumber(item.lineTotal),
      alreadyReturned,
    };
  }).filter((item) => item.returnableQuantity > 0);

  return res.status(200).json({
    success: true,
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    items,
  });
});

router.get('/returns/:id', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const record = await prisma.return.findUnique({
    where: { id },
    include: {
      originalOrder: true,
      customer: true,
      createdBy: true,
      returnItems: { include: { product: true, orderItem: true } },
    },
  });

  if (!record) {
    return res.status(404).json({ success: false, message: 'Return not found.', errorCode: 'RETURN_NOT_FOUND' });
  }

  return res.status(200).json({ success: true, return: serializeReturn(record) });
});

router.post('/returns', requireAuth, requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res) => {
  const payload = returnSchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({
      success: false,
      message: payload.error.issues[0]?.message ?? 'Invalid return payload.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { orderId, refundMethod, reason, idempotencyKey, items } = payload.data;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required', errorCode: 'UNAUTHORIZED' });
  }

  if (idempotencyKey) {
    const duplicate = await prisma.return.findUnique({ where: { idempotencyKey } });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This return has already been processed.',
        errorCode: 'DUPLICATE_RETURN',
      });
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      orderItems: { include: { product: true, returnItems: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.', errorCode: 'ORDER_NOT_FOUND' });
  }

  const orderItemMap = new Map(order.orderItems.map((item) => [item.id, item]));
  const returnEntries: Array<{ orderItemId: string; quantity: number; reason: string; unitRefundPrice: number; taxRefundAmount: number; refundAmount: number; productId: string }> = [];

  for (const item of items) {
    const orderItem = orderItemMap.get(item.orderItemId);

    if (!orderItem) {
      return res.status(400).json({ success: false, message: 'One or more order items are not part of this order.', errorCode: 'INVALID_RETURN_ITEM' });
    }

    const alreadyReturned = orderItem.returnItems.reduce<number>((sum, existing) => sum + existing.quantity, 0);
    const remainingQuantity = orderItem.quantity - alreadyReturned;

    if (item.quantity > remainingQuantity) {
      return res.status(400).json({ success: false, message: `Cannot return ${item.quantity} units for ${orderItem.productNameSnapshot}. Only ${remainingQuantity} remain eligible.`, errorCode: 'INVALID_RETURN_QUANTITY' });
    }

    const taxShare = Number(orderItem.taxAmount) * (item.quantity / orderItem.quantity);
    const refundAmount = Number(orderItem.lineTotal) * (item.quantity / orderItem.quantity);

    returnEntries.push({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      reason: item.reason || orderItem.productNameSnapshot,
      unitRefundPrice: Number(orderItem.actualUnitPrice),
      taxRefundAmount: Number((taxShare).toFixed(2)),
      refundAmount: Number(refundAmount.toFixed(2)),
      productId: orderItem.productId,
    });
  }

  const totalRefundAmount = returnEntries.reduce((sum, entry) => sum + entry.refundAmount, 0);

  const result = await prisma.$transaction(async (tx) => {
    const createdReturn = await tx.return.create({
      data: {
        returnNumber: createReturnNumber(),
        originalOrderId: order.id,
        customerId: order.customerId ?? null,
        createdById: userId,
        refundMethod,
        refundAmount: decimalFromNumber(totalRefundAmount),
        reason: reason || 'Customer requested return',
        status: 'COMPLETED',
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    for (const entry of returnEntries) {
      const orderItem = orderItemMap.get(entry.orderItemId)!;
      const returnItem = await tx.returnItem.create({
        data: {
          returnId: createdReturn.id,
          orderItemId: entry.orderItemId,
          productId: entry.productId,
          quantity: entry.quantity,
          unitRefundPrice: decimalFromNumber(entry.unitRefundPrice),
          taxRefundAmount: decimalFromNumber(entry.taxRefundAmount),
          refundAmount: decimalFromNumber(entry.refundAmount),
          reason: entry.reason,
        },
      });

      await tx.product.update({
        where: { id: entry.productId },
        data: { currentStock: { increment: entry.quantity } },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: entry.productId,
          type: 'RETURN',
          quantity: entry.quantity,
          previousStock: orderItem.product.currentStock,
          newStock: orderItem.product.currentStock + entry.quantity,
          referenceType: 'Return',
          referenceId: createdReturn.id,
          reason: 'Returned item stock restored',
          userId,
          unitCost: orderItem.product.purchasePrice,
        },
      });

      await createAuditLog({
        userId,
        action: 'RETURN_CREATED',
        entityType: 'Return',
        entityId: createdReturn.id,
        details: `Return ${createdReturn.returnNumber} processed for ${entry.quantity} ${orderItem.productNameSnapshot} unit(s).`,
      });

      void returnItem;
    }

    return createdReturn;
  });

  const freshReturn = await prisma.return.findUnique({
    where: { id: result.id },
    include: {
      originalOrder: true,
      customer: true,
      returnItems: { include: { product: true } },
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Return processed successfully.',
    return: serializeReturn(freshReturn),
  });
});

export default router;

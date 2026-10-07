import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

const decimalFromNumber = (value: number) => new Prisma.Decimal(Number(value).toFixed(2));
const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const lineItemSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required'),
  quantity: z.coerce.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
});

const checkoutSchema = z.object({
  customerName: z.string().trim().max(120).optional().or(z.literal('')).default(''),
  customerPhone: z.string().trim().max(30).optional().or(z.literal('')).default(''),
  customerEmail: z.string().trim().email().optional().or(z.literal('')).default(''),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  amountPaid: z.coerce.number().min(0, 'Amount paid cannot be negative').default(0),
  discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  notes: z.string().trim().max(500).optional().or(z.literal('')).default(''),
  items: z.array(lineItemSchema).min(1, 'At least one product is required for checkout'),
});

const serializeOrderItem = (item: any) => ({
  id: item.id,
  orderId: item.orderId,
  productId: item.productId,
  productNameSnapshot: item.productNameSnapshot,
  skuSnapshot: item.skuSnapshot,
  quantity: item.quantity,
  originalUnitPrice: toNumber(item.originalUnitPrice),
  actualUnitPrice: toNumber(item.actualUnitPrice),
  discount: toNumber(item.discount),
  gstRate: toNumber(item.gstRate),
  taxableAmount: toNumber(item.taxableAmount),
  cgst: toNumber(item.cgst),
  sgst: toNumber(item.sgst),
  igst: toNumber(item.igst),
  taxAmount: toNumber(item.taxAmount),
  lineTotal: toNumber(item.lineTotal),
  createdAt: item.createdAt,
});

const serializePayment = (payment: any) => ({
  id: payment.id,
  orderId: payment.orderId,
  paymentMethod: payment.paymentMethod,
  amount: toNumber(payment.amount),
  status: payment.status,
  referenceNo: payment.referenceNo,
  createdAt: payment.createdAt,
});

const serializeOrder = (order: any) => ({
  id: order.id,
  invoiceNumber: order.invoiceNumber,
  userId: order.userId,
  customerId: order.customerId,
  subtotal: toNumber(order.subtotal),
  discount: toNumber(order.discount),
  taxableAmount: toNumber(order.taxableAmount),
  cgst: toNumber(order.cgst),
  sgst: toNumber(order.sgst),
  igst: toNumber(order.igst),
  grandTotal: toNumber(order.grandTotal),
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

router.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid checkout payload',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const payload = parsed.data;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
    });
  }

  const items = payload.items.map((item) => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    discountAmount: Number(item.discountAmount),
    quantity: Number(item.quantity),
  }));

  const productMap = new Map<string, any>();

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'One or more products were not found.',
        errorCode: 'PRODUCT_NOT_FOUND',
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: `${product.name} is inactive and cannot be sold.`,
        errorCode: 'PRODUCT_INACTIVE',
      });
    }

    if (product.currentStock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}.`,
        errorCode: 'INSUFFICIENT_STOCK',
      });
    }

    productMap.set(product.id, product);
  }

  const orderDiscount = Number(payload.discountAmount ?? 0);
  const lineTotals = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;

    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = Math.min(item.discountAmount, itemSubtotal);
    const discountedSubtotal = Math.max(itemSubtotal - itemDiscount, 0);
    const gstRate = Number(product.gstRate);
    const taxAmount = (discountedSubtotal * gstRate) / 100;

    return {
      product,
      item,
      itemDiscount,
      discountedSubtotal,
      taxAmount,
      lineTotal: discountedSubtotal + taxAmount,
    };
  });

  if (lineTotals.some((entry) => !entry)) {
    return res.status(400).json({
      success: false,
      message: 'Unable to compute sale totals for the selected products.',
      errorCode: 'INVALID_CART',
    });
  }

  const subtotal = lineTotals.reduce((sum, entry) => sum + (entry!.discountedSubtotal + entry!.itemDiscount), 0);
  const taxableAmount = lineTotals.reduce((sum, entry) => sum + entry!.discountedSubtotal, 0);
  const taxAmount = lineTotals.reduce((sum, entry) => sum + entry!.taxAmount, 0);
  const orderGrandTotal = Math.max(taxableAmount + taxAmount - orderDiscount, 0);
  const amountPaid = Number(payload.amountPaid ?? 0);
  const paymentStatus = amountPaid > 0 ? 'PAID' : 'PENDING';

  const orderNumber = `HSH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Date.now() % 100000)}`;

  const orderRecord = await prisma.$transaction(async (tx) => {
    let customerId: string | null = null;

    const customerNameSnapshot = payload.customerName?.trim() || 'Walk-in Customer';
    const customerPhoneSnapshot = payload.customerPhone?.trim() || null;
    const customerEmailSnapshot = payload.customerEmail?.trim() || null;
    const customerAddressSnapshot = null;

    if (payload.customerName || payload.customerPhone || payload.customerEmail) {
      const customer = await tx.customer.create({
        data: {
          name: customerNameSnapshot,
          phone: customerPhoneSnapshot,
          email: customerEmailSnapshot,
          address: customerAddressSnapshot,
        },
      });

      customerId = customer.id;
    }

    const order = await tx.order.create({
      data: {
        invoiceNumber: orderNumber,
        userId,
        customerId,
        customerNameSnapshot,
        customerPhoneSnapshot,
        customerAddressSnapshot,
        customerEmailSnapshot,
        subtotal: decimalFromNumber(subtotal),
        discount: decimalFromNumber(orderDiscount),
        taxableAmount: decimalFromNumber(taxableAmount),
        cgst: decimalFromNumber(lineTotals.reduce((sum, entry) => sum + (entry!.discountedSubtotal * Number(entry!.product.gstRate)) / 200, 0)),
        sgst: decimalFromNumber(lineTotals.reduce((sum, entry) => sum + (entry!.discountedSubtotal * Number(entry!.product.gstRate)) / 200, 0)),
        igst: decimalFromNumber(0),
        grandTotal: decimalFromNumber(orderGrandTotal),
        paymentStatus,
        orderStatus: 'COMPLETED',
      },
    });

    const createdItems = [] as any[];

    for (const entry of lineTotals) {
      if (!entry) continue;

      const product = entry.product;
      const item = entry.item;

      const nextStock = product.currentStock - item.quantity;

      const createdItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          quantity: item.quantity,
          originalUnitPrice: decimalFromNumber(item.unitPrice),
          actualUnitPrice: decimalFromNumber(item.unitPrice),
          discount: decimalFromNumber(entry.itemDiscount),
          gstRate: decimalFromNumber(Number(product.gstRate)),
          taxableAmount: decimalFromNumber(entry.discountedSubtotal),
          cgst: decimalFromNumber((entry.discountedSubtotal * Number(product.gstRate)) / 200),
          sgst: decimalFromNumber((entry.discountedSubtotal * Number(product.gstRate)) / 200),
          igst: decimalFromNumber(0),
          taxAmount: decimalFromNumber(entry.taxAmount),
          lineTotal: decimalFromNumber(entry.lineTotal),
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: nextStock },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: 'SALE',
          quantity: item.quantity,
          previousStock: product.currentStock,
          newStock: nextStock,
          referenceType: 'Order',
          referenceId: order.id,
          reason: 'Point of sale sale',
          userId,
        },
      });

      createdItems.push(createdItem);
    }

    const payment = amountPaid > 0 ? await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: payload.paymentMethod,
        amount: decimalFromNumber(Math.min(amountPaid, orderGrandTotal)),
        status: paymentStatus,
        referenceNo: `PAY-${Date.now()}`,
      },
    }) : null;

    await createAuditLog({
      userId,
      action: 'SALE_CREATED',
      entityType: 'Order',
      entityId: order.id,
      details: `Sale created for ${order.invoiceNumber} with ${items.length} item(s).`,
    });

    return {
      order,
      items: createdItems,
      payment,
      customerId,
      stockUpdated: true,
    };
  });

  return res.status(200).json({
    success: true,
    message: 'Sale completed successfully.',
    order: {
      ...serializeOrder(orderRecord.order),
      customerId: orderRecord.customerId,
      items: orderRecord.items.map(serializeOrderItem),
    },
    payment: orderRecord.payment ? serializePayment(orderRecord.payment) : null,
    stockUpdated: orderRecord.stockUpdated,
  });
});

export default router;

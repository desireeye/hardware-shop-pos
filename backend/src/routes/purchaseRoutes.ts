import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';

const router = Router();

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const purchaseItemSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.'),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative.'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

const purchaseSchema = z.object({
  supplierId: z.string().trim().min(1, 'Supplier is required.'),
  invoiceNumber: z.string().trim().max(60).optional().or(z.literal('')).default(''),
  notes: z.string().trim().max(500).optional().or(z.literal('')).default(''),
  paidAmount: z.coerce.number().min(0).optional().default(0),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required.'),
});

const createPurchaseNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${y}${m}${d}-${random}`;
};

const serializePurchase = (purchase: any) => ({
  id: purchase.id,
  supplierId: purchase.supplierId,
  supplierName: purchase.supplier?.name ?? null,
  purchaseNumber: purchase.purchaseNumber,
  invoiceNumber: purchase.invoiceNumber ?? null,
  totalAmount: toNumber(purchase.totalAmount),
  paidAmount: toNumber(purchase.paidAmount),
  status: purchase.status,
  notes: purchase.notes ?? null,
  createdAt: purchase.createdAt,
  items: (purchase.purchaseItems ?? []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name ?? item.productNameSnapshot ?? null,
    sku: item.product?.sku ?? null,
    quantity: item.quantity,
    unitCost: toNumber(item.unitCost),
    taxRate: toNumber(item.taxRate),
    taxAmount: toNumber(item.taxAmount),
    subtotal: toNumber(item.subtotal),
    totalAmount: toNumber(item.totalAmount),
  })),
});

router.get('/', requireAuth, async (_req, res) => {
  const purchases = await prisma.purchase.findMany({
    include: {
      supplier: true,
      purchaseItems: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({
    success: true,
    purchases: purchases.map(serializePurchase),
    total: purchases.length,
    page: 1,
    pageSize: purchases.length || 1,
    totalPages: 1,
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().trim().min(1) }).parse(req.params);

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      purchaseItems: { include: { product: true } },
    },
  });

  if (!purchase) {
    return res.status(404).json({ success: false, message: 'Purchase not found.', errorCode: 'PURCHASE_NOT_FOUND' });
  }

  return res.status(200).json({ success: true, purchase: serializePurchase(purchase) });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const payload = purchaseSchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({
      success: false,
      message: payload.error.issues[0]?.message ?? 'Invalid purchase data.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { supplierId, invoiceNumber, notes, paidAmount, items } = payload.data;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    return res.status(404).json({ success: false, message: 'Supplier not found.', errorCode: 'SUPPLIER_NOT_FOUND' });
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const invalidProduct = items.find((item) => !productMap.has(item.productId));
  if (invalidProduct) {
    return res.status(404).json({
      success: false,
      message: 'One or more product ids in the purchase are invalid.',
      errorCode: 'PRODUCT_NOT_FOUND',
    });
  }

  const purchaseItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const subtotal = item.unitCost * item.quantity;
    const taxAmount = subtotal * (item.taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitCost: new Prisma.Decimal(item.unitCost.toFixed(2)),
      taxRate: new Prisma.Decimal(item.taxRate.toFixed(2)),
      taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
      productNameSnapshot: product.name,
    };
  });

  const totalAmount = purchaseItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);

  const result = await prisma.$transaction(async (tx) => {
    const createdPurchase = await tx.purchase.create({
      data: {
        supplierId,
        purchaseNumber: createPurchaseNumber(),
        invoiceNumber: invoiceNumber || null,
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        paidAmount: new Prisma.Decimal((paidAmount ?? 0).toFixed(2)),
        status: (paidAmount ?? 0) >= totalAmount ? 'PAID' : 'PENDING',
        notes: notes || null,
      },
      include: {
        supplier: true,
      },
    });

    const createdItems = await Promise.all(purchaseItems.map(async (item) => {
      const productData = productMap.get(item.productId)!;
      const previousStock = productData.currentStock;

      const createdItem = await tx.purchaseItem.create({
        data: {
          purchaseId: createdPurchase.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          totalAmount: item.totalAmount,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: {
          supplierId,
          purchasePrice: item.unitCost,
          currentStock: { increment: item.quantity },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'STOCK_IN',
          quantity: item.quantity,
          previousStock,
          newStock: updatedProduct.currentStock,
          referenceType: 'Purchase',
          referenceId: createdPurchase.id,
          reason: notes || 'Stock purchase',
          unitCost: item.unitCost,
          userId: req.user?.id,
        },
      });

      return createdItem;
    }));

    await createAuditLog({
      userId: req.user?.id,
      action: 'STOCK_IN',
      entityType: 'Purchase',
      entityId: createdPurchase.id,
      details: `Stock purchase ${createdPurchase.purchaseNumber} created for supplier ${supplier.name}.`,
    });

    return { ...createdPurchase, purchaseItems: createdItems };
  });

  const freshPurchase = await prisma.purchase.findUnique({
    where: { id: result.id },
    include: {
      supplier: true,
      purchaseItems: { include: { product: true } },
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Purchase recorded successfully.',
    purchase: serializePurchase(freshPurchase),
  });
});

export default router;

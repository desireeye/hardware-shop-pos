import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';
import { idParamSchema, productSchema, productUpdateSchema, stockAdjustmentSchema } from '../validators/product.js';

const router = Router();

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const serializeProduct = (product: any) => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  barcode: product.barcode,
  categoryId: product.categoryId,
  brandId: product.brandId,
  supplierId: product.supplierId,
  unit: product.unit,
  purchasePrice: toNumber(product.purchasePrice),
  sellingPrice: toNumber(product.sellingPrice),
  mrp: toNumber(product.mrp),
  gstRate: toNumber(product.gstRate),
  hsnCode: product.hsnCode,
  currentStock: product.currentStock,
  minimumStock: product.minimumStock,
  description: product.description,
  isActive: product.isActive,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  category: product.category ? { id: product.category.id, name: product.category.name, isActive: product.category.isActive } : null,
  brand: product.brand ? { id: product.brand.id, name: product.brand.name, isActive: product.brand.isActive } : null,
  supplier: product.supplier ? { id: product.supplier.id, name: product.supplier.name, phone: product.supplier.phone ?? null } : null,
});

const serializeTransaction = (transaction: any) => ({
  id: transaction.id,
  productId: transaction.productId,
  type: transaction.type,
  quantity: transaction.quantity,
  previousStock: transaction.previousStock,
  newStock: transaction.newStock,
  reason: transaction.reason,
  unitCost: transaction.unitCost ? toNumber(transaction.unitCost) : null,
  notes: transaction.notes,
  userId: transaction.userId,
  createdAt: transaction.createdAt,
});

router.get('/', requireAuth, async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? Number(req.query.pageSize ?? 20));
  const status = String(req.query.status ?? 'ALL').trim().toUpperCase();

  const where: Prisma.ProductWhereInput = {
    isActive: req.query.active === undefined ? undefined : req.query.active === 'true',
    AND: search
      ? [
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        ]
      : undefined,
  };

  const allProducts = await prisma.product.findMany({
    where,
    include: { category: true, brand: true, supplier: true },
    orderBy: { createdAt: 'desc' },
  });

  const filteredProducts = allProducts.filter((product) => {
    if (status === 'LOW_STOCK') return product.currentStock <= product.minimumStock;
    if (status === 'OUT_OF_STOCK') return product.currentStock === 0;
    if (status === 'IN_STOCK') return product.currentStock > product.minimumStock;
    return true;
  });

  const total = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);

  return res.status(200).json({
    success: true,
    products: paginatedProducts.map(serializeProduct),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit || 1)),
  });
});

router.get('/low-stock', requireAuth, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? Number(req.query.limit ?? 20));
  const status = String(req.query.status ?? 'LOW_STOCK').trim().toUpperCase();

  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, brand: true, supplier: true },
    orderBy: { currentStock: 'asc' },
  });

  const filteredProducts = allProducts.filter((product) => {
    if (status === 'OUT_OF_STOCK') return product.currentStock === 0;
    if (status === 'LOW_STOCK') return product.currentStock <= product.minimumStock;
    if (status === 'NORMAL') return product.currentStock > product.minimumStock;
    return true;
  });

  const total = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  return res.status(200).json({
    success: true,
    products: paginatedProducts.map(serializeProduct),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize || 1)),
  });
});

router.get('/stock', requireAuth, async (_req, res) => {
  const transactions = await prisma.inventoryTransaction.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return res.status(200).json({
    success: true,
    transactions: transactions.map((transaction) => ({
      ...serializeTransaction(transaction),
      product: transaction.product ? { id: transaction.product.id, name: transaction.product.name, sku: transaction.product.sku } : null,
    })),
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, brand: true, supplier: true },
  });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.', errorCode: 'PRODUCT_NOT_FOUND' });
  }

  return res.status(200).json({ success: true, product: serializeProduct(product) });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid product details',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const payload = parsed.data;
  const sku = payload.sku.trim();
  const barcode = payload.barcode?.trim() || null;

  const existingProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { sku },
        ...(barcode ? [{ barcode }] : []),
      ],
    },
  });

  if (existingProduct) {
    return res.status(409).json({
      success: false,
      message: existingProduct.sku === sku ? 'A product with this SKU already exists.' : 'A product with this barcode already exists.',
      errorCode: 'PRODUCT_ALREADY_EXISTS',
    });
  }

  const product = await prisma.product.create({
    data: {
      ...payload,
      sku,
      barcode,
      purchasePrice: new Prisma.Decimal(payload.purchasePrice),
      sellingPrice: new Prisma.Decimal(payload.sellingPrice),
      mrp: new Prisma.Decimal(payload.mrp),
      gstRate: new Prisma.Decimal(payload.gstRate),
      currentStock: payload.currentStock,
      minimumStock: payload.minimumStock,
    },
    include: { category: true, brand: true, supplier: true },
  });

  if (payload.currentStock > 0) {
    await prisma.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'STOCK_IN',
        quantity: payload.currentStock,
        previousStock: 0,
        newStock: payload.currentStock,
        reason: 'Initial stock entry',
        userId: req.user?.id,
      },
    });
  }

  await createAuditLog({
    userId: req.user?.id,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: product.id,
    details: `Product created: ${product.name} (${product.sku})`,
  });

  return res.status(201).json({ success: true, message: 'Product created successfully.', product: serializeProduct(product) });
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = idParamSchema.parse(req.params);
  const parsed = productUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid product update',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const payload = parsed.data;
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.', errorCode: 'PRODUCT_NOT_FOUND' });
  }

  if (payload.sku && payload.sku !== product.sku) {
    const duplicateSku = await prisma.product.findUnique({ where: { sku: payload.sku.trim() } });
    if (duplicateSku && duplicateSku.id !== id) {
      return res.status(409).json({ success: false, message: 'A product with this SKU already exists.', errorCode: 'PRODUCT_ALREADY_EXISTS' });
    }
  }

  if (payload.barcode && payload.barcode !== product.barcode) {
    const duplicateBarcode = await prisma.product.findUnique({ where: { barcode: payload.barcode.trim() } });
    if (duplicateBarcode && duplicateBarcode.id !== id) {
      return res.status(409).json({ success: false, message: 'A product with this barcode already exists.', errorCode: 'PRODUCT_ALREADY_EXISTS' });
    }
  }

  const updateData: Record<string, any> = { ...payload };

  if (payload.purchasePrice !== undefined) updateData.purchasePrice = new Prisma.Decimal(payload.purchasePrice);
  if (payload.sellingPrice !== undefined) updateData.sellingPrice = new Prisma.Decimal(payload.sellingPrice);
  if (payload.mrp !== undefined) updateData.mrp = new Prisma.Decimal(payload.mrp);
  if (payload.gstRate !== undefined) updateData.gstRate = new Prisma.Decimal(payload.gstRate);
  if (payload.sku !== undefined) updateData.sku = payload.sku.trim();
  if (payload.barcode !== undefined) updateData.barcode = payload.barcode ? payload.barcode.trim() : null;
  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.description !== undefined) updateData.description = payload.description ? payload.description.trim() : null;

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: updateData,
    include: { category: true, brand: true, supplier: true },
  });

  const priceChanged =
    payload.purchasePrice !== undefined ||
    payload.sellingPrice !== undefined ||
    payload.mrp !== undefined;

  if (priceChanged) {
    await createAuditLog({
      userId: req.user?.id,
      action: 'PRODUCT_PRICE_CHANGED',
      entityType: 'Product',
      entityId: updatedProduct.id,
      details: `Price updated for product ${updatedProduct.name}.`,
    });
  }

  return res.status(200).json({ success: true, message: 'Product updated successfully.', product: serializeProduct(updatedProduct) });
});

router.post('/stock', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parsed = stockAdjustmentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid stock adjustment',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const payload = parsed.data;
  const product = await prisma.product.findUnique({ where: { sku: payload.sku.trim() } });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.', errorCode: 'PRODUCT_NOT_FOUND' });
  }

  const delta = payload.quantity;
  const nextStock = product.currentStock + delta;

  if (nextStock < 0) {
    return res.status(400).json({
      success: false,
      message: 'Stock cannot go below zero.',
      errorCode: 'INVALID_STOCK_ADJUSTMENT',
    });
  }

  const mappedType = payload.type === 'STOCK_IN' ? 'STOCK_IN' : payload.type === 'ADJUSTMENT' ? 'ADJUSTMENT' : payload.type === 'DAMAGED' ? 'DAMAGED' : 'LOST';

  const updatedProduct = await prisma.$transaction(async (tx) => {
    const [updated, transaction] = await Promise.all([
      tx.product.update({
        where: { id: product.id },
        data: { currentStock: nextStock },
      }),
      tx.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: mappedType,
          quantity: payload.quantity,
          previousStock: product.currentStock,
          newStock: nextStock,
          reason: payload.reason,
          unitCost: payload.unitCost !== undefined && payload.unitCost !== null ? new Prisma.Decimal(payload.unitCost) : null,
          userId: req.user?.id,
          notes: payload.reason,
        },
      }),
    ]);

    return { updated, transaction };
  });

  const auditAction =
    payload.type === 'STOCK_IN' ? 'STOCK_IN' : payload.type === 'ADJUSTMENT' ? 'STOCK_ADJUSTED' : payload.type === 'DAMAGED' ? 'STOCK_DAMAGED' : 'STOCK_LOST';

  await createAuditLog({
    userId: req.user?.id,
    action: auditAction,
    entityType: 'Product',
    entityId: product.id,
    details: `${payload.type} stock update for ${product.name}: ${payload.quantity} units`,
  });

  return res.status(200).json({
    success: true,
    message: 'Inventory updated successfully.',
    product: { ...serializeProduct({ ...product, currentStock: updatedProduct.updated.currentStock }),
    },
    transaction: serializeTransaction(updatedProduct.transaction),
  });
});

router.patch('/:id/toggle-status', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { active } = z.object({ active: z.boolean() }).parse(req.body);

  const product = await prisma.product.findUnique({ where: { id }, include: { category: true, brand: true, supplier: true } });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.', errorCode: 'PRODUCT_NOT_FOUND' });
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: { isActive: active },
    include: { category: true, brand: true, supplier: true },
  });

  await createAuditLog({
    userId: req.user?.id,
    action: active ? 'PRODUCT_REACTIVATED' : 'PRODUCT_DEACTIVATED',
    entityType: 'Product',
    entityId: updatedProduct.id,
    details: `Product status changed for ${updatedProduct.name}.`,
  });

  return res.status(200).json({ success: true, message: 'Product status updated successfully.', product: serializeProduct(updatedProduct) });
});

export default router;

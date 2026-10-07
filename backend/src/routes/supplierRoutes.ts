import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required.'),
  phone: z.string().trim().max(20).optional().or(z.literal('')).default(''),
  email: z.string().trim().email().optional().or(z.literal('')).default(''),
  address: z.string().trim().max(250).optional().or(z.literal('')).default(''),
  gstin: z.string().trim().max(30).optional().or(z.literal('')).default(''),
});

const serializeSupplier = (supplier: any) => ({
  id: supplier.id,
  name: supplier.name,
  phone: supplier.phone ?? null,
  email: supplier.email ?? null,
  address: supplier.address ?? null,
  gstin: supplier.gstin ?? null,
  createdAt: supplier.createdAt,
  updatedAt: supplier.updatedAt,
});

router.get('/', requireAuth, async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({
    success: true,
    suppliers: suppliers.map(serializeSupplier),
    total: suppliers.length,
    page: 1,
    pageSize: suppliers.length || 1,
    totalPages: 1,
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().trim().min(1) }).parse(req.params);

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: 'desc' },
        include: { purchaseItems: { include: { product: true } } },
      },
    },
  });

  if (!supplier) {
    return res.status(404).json({ success: false, message: 'Supplier not found.', errorCode: 'SUPPLIER_NOT_FOUND' });
  }

  return res.status(200).json({
    success: true,
    supplier: serializeSupplier(supplier),
    purchases: supplier.purchases.map((purchase) => ({
      id: purchase.id,
      supplierId: purchase.supplierId,
      purchaseNumber: purchase.purchaseNumber,
      invoiceNumber: purchase.invoiceNumber,
      totalAmount: toNumber(purchase.totalAmount),
      paidAmount: toNumber(purchase.paidAmount),
      status: purchase.status,
      notes: purchase.notes,
      createdAt: purchase.createdAt,
      items: purchase.purchaseItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitCost: toNumber(item.unitCost),
        taxRate: toNumber(item.taxRate),
        taxAmount: toNumber(item.taxAmount),
        totalAmount: toNumber(item.totalAmount),
      })),
    })),
  });
});

router.get('/:id/purchases', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.string().trim().min(1) }).parse(req.params);

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return res.status(404).json({ success: false, message: 'Supplier not found.', errorCode: 'SUPPLIER_NOT_FOUND' });
  }

  const purchases = await prisma.purchase.findMany({
    where: { supplierId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      purchaseItems: { include: { product: true } },
    },
  });

  return res.status(200).json({
    success: true,
    purchases: purchases.map((purchase) => ({
      id: purchase.id,
      supplierId: purchase.supplierId,
      purchaseNumber: purchase.purchaseNumber,
      invoiceNumber: purchase.invoiceNumber,
      totalAmount: toNumber(purchase.totalAmount),
      paidAmount: toNumber(purchase.paidAmount),
      status: purchase.status,
      notes: purchase.notes,
      createdAt: purchase.createdAt,
      items: purchase.purchaseItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitCost: toNumber(item.unitCost),
        taxRate: toNumber(item.taxRate),
        taxAmount: toNumber(item.taxAmount),
        subtotal: toNumber(item.subtotal),
        totalAmount: toNumber(item.totalAmount),
      })),
    })),
  });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const payload = supplierSchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({
      success: false,
      message: payload.error.issues[0]?.message ?? 'Invalid supplier payload.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: payload.data.name,
      phone: payload.data.phone || null,
      email: payload.data.email || null,
      address: payload.data.address || null,
      gstin: payload.data.gstin || null,
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Supplier created successfully.',
    supplier: serializeSupplier(supplier),
  });
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { id } = z.object({ id: z.string().trim().min(1) }).parse(req.params);
  const payload = supplierSchema.partial().safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({ success: false, message: payload.error.issues[0]?.message ?? 'Invalid supplier update.', errorCode: 'VALIDATION_ERROR' });
  }

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Supplier not found.', errorCode: 'SUPPLIER_NOT_FOUND' });
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...payload.data,
      phone: payload.data.phone === '' ? null : payload.data.phone,
      email: payload.data.email === '' ? null : payload.data.email,
      address: payload.data.address === '' ? null : payload.data.address,
      gstin: payload.data.gstin === '' ? null : payload.data.gstin,
    },
  });

  return res.status(200).json({ success: true, message: 'Supplier updated successfully.', supplier: serializeSupplier(supplier) });
});

export default router;

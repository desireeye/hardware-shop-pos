import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(200),
  sku: z.string().trim().min(2, 'SKU is required').max(80),
  barcode: z.string().trim().max(80).nullable().optional(),
  categoryId: z.string().trim().min(1).optional().nullable(),
  brandId: z.string().trim().min(1).optional().nullable(),
  supplierId: z.string().trim().min(1).optional().nullable(),
  unit: z.string().trim().min(1, 'Unit is required').max(30),
  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative'),
  sellingPrice: z.coerce.number().min(0, 'Selling price cannot be negative'),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative'),
  gstRate: z.coerce.number().min(0).max(100),
  hsnCode: z.string().trim().min(2).max(30).optional().nullable(),
  currentStock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  minimumStock: z.coerce.number().int().min(0, 'Minimum stock cannot be negative').default(0),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const productUpdateSchema = productSchema.partial();

export const stockAdjustmentSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  type: z.enum(['STOCK_IN', 'ADJUSTMENT', 'DAMAGED', 'LOST']),
  quantity: z.coerce.number().int('Quantity must be an integer'),
  reason: z.string().trim().min(1, 'Reason is required').max(255).optional().or(z.literal('')).default('Inventory update'),
  unitCost: z.coerce.number().min(0).optional().nullable(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'Product id is required'),
});

import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const paymentMethodValues = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'] as const;

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const normalizePaymentMethod = (value?: string) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  return paymentMethodValues.includes(upper as typeof paymentMethodValues[number]) ? (upper as typeof paymentMethodValues[number]) : undefined;
};

const normalizeStatus = (value?: string) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  if (['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED'].includes(upper)) {
    return upper as any;
  }
  return undefined;
};

const normalizeReturnStatus = (value?: string) => {
  if (!value || value === 'ALL') return undefined;
  const upper = value.toUpperCase();
  if (['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(upper)) {
    return upper as any;
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

const normalizeRange = (value: string | undefined) => {
  const normalized = (value ?? 'today').toLowerCase();
  return ['today', 'yesterday', 'this_week', 'this_month', 'custom'].includes(normalized) ? normalized : 'today';
};

const getRangeBounds = (range: string = 'today', fromDate?: string, toDate?: string) => {
  const now = new Date();

  if (range === 'custom' && fromDate && toDate) {
    const from = toDateTime(fromDate);
    const to = toDateTime(toDate, true);
    if (from && to && from.getTime() <= to.getTime()) {
      return { from, to, rangeName: 'Custom Range' };
    }
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === 'today') return { from: startOfToday, to: endOfToday, rangeName: 'Today' };

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (range === 'yesterday') {
    return {
      from: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
      to: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
      rangeName: 'Yesterday',
    };
  }

  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  if (range === 'this_week') return { from: weekStart, to: endOfToday, rangeName: 'This Week' };

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  if (range === 'this_month') return { from: monthStart, to: endOfToday, rangeName: 'This Month' };

  return { from: startOfToday, to: endOfToday, rangeName: 'Today' };
};

const escapeCsv = (value: unknown) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsv = (headers: string[], rows: unknown[][]) => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map((value) => escapeCsv(value)).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const withDateFilters = (from?: Date, to?: Date) => ({
  ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
});

router.get('/sales', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({
    range: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    paymentMethod: z.string().optional(),
    customer: z.string().optional(),
    invoice: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid sales report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { range, fromDate, toDate, paymentMethod, customer, invoice, page, pageSize } = parsed.data;
  const bounds = getRangeBounds(normalizeRange(range), fromDate, toDate);
  const paymentFilter = normalizePaymentMethod(paymentMethod);
  const where: Prisma.OrderWhereInput = {
    orderStatus: 'COMPLETED',
    ...(customer ? { OR: [{ customerNameSnapshot: { contains: customer, mode: 'insensitive' } }, { customerPhoneSnapshot: { contains: customer, mode: 'insensitive' } }, { customer: { name: { contains: customer, mode: 'insensitive' } } }] } : {}),
    ...(invoice ? { invoiceNumber: { contains: invoice, mode: 'insensitive' } } : {}),
    ...(paymentFilter ? { payments: { some: { paymentMethod: paymentFilter } } } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, payments: true, user: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    rows: orders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      date: order.createdAt,
      customer: order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      tax: toNumber(order.cgst.plus(order.sgst).plus(order.igst)),
      grandTotal: toNumber(order.grandTotal),
      paymentMethod: order.payments[0]?.paymentMethod ?? 'N/A',
      createdBy: order.user?.name ?? 'Unknown',
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.get('/products', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid product report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { range, fromDate, toDate, page, pageSize } = parsed.data;
  const bounds = getRangeBounds(normalizeRange(range), fromDate, toDate);

  const orderItems = await prisma.orderItem.findMany({
    where: { order: { orderStatus: 'COMPLETED', ...withDateFilters(bounds.from, bounds.to) } },
    include: { product: true },
  });

  const grouped = new Map<string, { product: string; sku: string; quantitySold: number; grossSales: Prisma.Decimal; discount: Prisma.Decimal; tax: Prisma.Decimal; netSales: Prisma.Decimal }>();

  for (const item of orderItems) {
    const productId = item.productId;
    const entry = grouped.get(productId) ?? {
      product: item.product?.name ?? item.productNameSnapshot,
      sku: item.product?.sku ?? item.skuSnapshot,
      quantitySold: 0,
      grossSales: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      netSales: new Prisma.Decimal(0),
    };

    entry.quantitySold += item.quantity;
    entry.grossSales = entry.grossSales.plus(item.originalUnitPrice.mul(item.quantity));
    entry.discount = entry.discount.plus(item.discount);
    entry.tax = entry.tax.plus(item.taxAmount);
    entry.netSales = entry.netSales.plus(item.lineTotal);
    grouped.set(productId, entry);
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.quantitySold - a.quantitySold);
  const start = (page - 1) * pageSize;
  const paginated = rows.slice(start, start + pageSize);

  return res.status(200).json({
    success: true,
    rows: paginated.map((row) => ({
      product: row.product,
      sku: row.sku,
      quantitySold: row.quantitySold,
      grossSales: toNumber(row.grossSales),
      discount: toNumber(row.discount),
      tax: toNumber(row.tax),
      netSales: toNumber(row.netSales),
    })),
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.ceil(rows.length / pageSize) || 1,
  });
});

router.get('/customers', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid customer report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { range, fromDate, toDate, page, pageSize } = parsed.data;
  const bounds = getRangeBounds(normalizeRange(range), fromDate, toDate);

  const orders = await prisma.order.findMany({
    where: { orderStatus: 'COMPLETED', customerId: { not: null }, ...withDateFilters(bounds.from, bounds.to) },
    include: { customer: true },
  });

  const grouped = new Map<string, { customer: string; phone: string | null; orderCount: number; totalPurchases: Prisma.Decimal; lastPurchase: Date | null }>();

  for (const order of orders) {
    const customerKey = order.customerId ?? order.customerNameSnapshot ?? 'walk-in';
    const record = grouped.get(customerKey) ?? {
      customer: order.customer?.name ?? order.customerNameSnapshot ?? 'Walk-in Customer',
      phone: order.customer?.phone ?? order.customerPhoneSnapshot ?? null,
      orderCount: 0,
      totalPurchases: new Prisma.Decimal(0),
      lastPurchase: null,
    };
    record.orderCount += 1;
    record.totalPurchases = record.totalPurchases.plus(order.grandTotal);
    record.lastPurchase = record.lastPurchase && record.lastPurchase > order.createdAt ? record.lastPurchase : order.createdAt;
    grouped.set(customerKey, record);
  }

  const rows = Array.from(grouped.values()).sort((a, b) => Number(b.totalPurchases) - Number(a.totalPurchases));
  const start = (page - 1) * pageSize;
  const paginated = rows.slice(start, start + pageSize);

  return res.status(200).json({
    success: true,
    rows: paginated.map((row) => ({
      customer: row.customer,
      phone: row.phone,
      numberOfOrders: row.orderCount,
      totalPurchases: toNumber(row.totalPurchases),
      lastPurchase: row.lastPurchase,
    })),
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.ceil(rows.length / pageSize) || 1,
  });
});

router.get('/returns', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), search: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid returns report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { range, fromDate, toDate, search, page, pageSize } = parsed.data;
  const bounds = getRangeBounds(normalizeRange(range), fromDate, toDate);

  const where: Prisma.ReturnWhereInput = {
    ...(search ? { OR: [{ returnNumber: { contains: search, mode: 'insensitive' } }, { reason: { contains: search, mode: 'insensitive' } }, { originalOrder: { invoiceNumber: { contains: search, mode: 'insensitive' } } }] } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: { originalOrder: true, customer: true, returnItems: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.return.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    rows: returns.map((record) => ({
      returnNumber: record.returnNumber,
      originalInvoice: record.originalOrder.invoiceNumber,
      customer: record.customer?.name ?? record.originalOrder.customerNameSnapshot ?? 'Walk-in Customer',
      date: record.createdAt,
      returnedItems: record.returnItems.reduce((sum, item) => sum + item.quantity, 0),
      refundAmount: toNumber(record.refundAmount),
      refundMethod: record.refundMethod,
      status: record.status,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.get('/purchases', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), supplierId: z.string().optional(), status: z.string().optional(), search: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid purchase report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { range, fromDate, toDate, supplierId, status, search, page, pageSize } = parsed.data;
  const bounds = getRangeBounds(normalizeRange(range), fromDate, toDate);
  const where: Prisma.PurchaseWhereInput = {
    ...(supplierId ? { supplierId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(search ? { OR: [{ purchaseNumber: { contains: search, mode: 'insensitive' } }, { invoiceNumber: { contains: search, mode: 'insensitive' } }, { supplier: { name: { contains: search, mode: 'insensitive' } } }] } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where }),
  ]);

  return res.status(200).json({
    success: true,
    rows: purchases.map((purchase) => ({
      purchaseNumber: purchase.purchaseNumber,
      supplier: purchase.supplier?.name ?? 'Unknown Supplier',
      date: purchase.createdAt,
      purchaseTotal: toNumber(purchase.totalAmount),
      paymentStatus: purchase.status,
      paymentMethod: 'N/A',
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

router.get('/inventory', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ category: z.string().optional(), brand: z.string().optional(), supplier: z.string().optional(), stockStatus: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid inventory report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { category, brand, supplier, stockStatus, page, pageSize } = parsed.data;
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(category ? { categoryId: category } : {}),
    ...(brand ? { brandId: brand } : {}),
    ...(supplier ? { supplierId: supplier } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, brand: true, supplier: true },
      orderBy: { currentStock: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  const filteredProducts = stockStatus
    ? products.filter((product) => {
        if (stockStatus === 'OUT_OF_STOCK') return product.currentStock <= 0;
        if (stockStatus === 'LOW_STOCK') return product.currentStock > 0 && product.currentStock <= product.minimumStock;
        return true;
      })
    : products;

  const start = (page - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(start, start + pageSize);

  return res.status(200).json({
    success: true,
    rows: paginatedProducts.map((product) => ({
      product: product.name,
      sku: product.sku,
      category: product.category?.name ?? 'Uncategorized',
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      purchasePrice: toNumber(product.purchasePrice),
      sellingPrice: toNumber(product.sellingPrice),
      estimatedStockValue: toNumber(new Prisma.Decimal(product.currentStock ?? 0).mul(product.purchasePrice ?? new Prisma.Decimal(0))),
      stockStatus: product.currentStock <= 0 ? 'OUT OF STOCK' : product.currentStock <= product.minimumStock ? 'LOW STOCK' : 'OK',
    })),
    total: filteredProducts.length,
    page,
    pageSize,
    totalPages: Math.ceil(filteredProducts.length / pageSize) || 1,
  });
});

router.get('/suppliers', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid supplier report filters.', errorCode: 'VALIDATION_ERROR' });
  }

  const { search, page, pageSize } = parsed.data;
  const where: Prisma.SupplierWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { gstin: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { purchases: true, products: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  const rows = suppliers.map((supplier) => {
    const totalSpend = supplier.purchases.reduce((sum, purchase) => sum + Number(purchase.totalAmount), 0);
    const lastPurchase = supplier.purchases.length > 0
      ? supplier.purchases.reduce((latest, purchase) => (purchase.createdAt > latest.createdAt ? purchase : latest), supplier.purchases[0])
      : null;

    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone ?? null,
      email: supplier.email ?? null,
      gstin: supplier.gstin ?? null,
      activeProducts: supplier.products.filter((product) => product.isActive).length,
      totalPurchases: supplier.purchases.length,
      totalSpend,
      lastPurchase: lastPurchase ? lastPurchase.createdAt : null,
    };
  });

  return res.status(200).json({
    success: true,
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

const exportCsv = (res: any, fileName: string, headers: string[], rows: unknown[][]) => {
  const csvData = buildCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
  res.send(csvData);
};

router.get('/sales/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), paymentMethod: z.string().optional(), customer: z.string().optional(), invoice: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const bounds = getRangeBounds(normalizeRange(data.range), data.fromDate, data.toDate);
  const where: Prisma.OrderWhereInput = {
    orderStatus: 'COMPLETED',
    ...(data.customer ? { OR: [{ customerNameSnapshot: { contains: data.customer, mode: 'insensitive' } }, { customer: { name: { contains: data.customer, mode: 'insensitive' } } }] } : {}),
    ...(data.invoice ? { invoiceNumber: { contains: data.invoice, mode: 'insensitive' } } : {}),
    ...(normalizePaymentMethod(data.paymentMethod) ? { payments: { some: { paymentMethod: normalizePaymentMethod(data.paymentMethod) } } } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };

  const rows = await prisma.order.findMany({ where, include: { customer: true, payments: true, user: true }, orderBy: { createdAt: 'desc' } });
  exportCsv(res, 'sales-report', ['Invoice Number', 'Date', 'Customer', 'Subtotal', 'Discount', 'Tax', 'Grand Total', 'Payment Method', 'Created By'], rows.map((order) => [
    order.invoiceNumber,
    order.createdAt.toISOString(),
    order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
    toNumber(order.subtotal),
    toNumber(order.discount),
    toNumber(order.cgst.plus(order.sgst).plus(order.igst)),
    toNumber(order.grandTotal),
    order.payments[0]?.paymentMethod ?? 'N/A',
    order.user?.name ?? 'Unknown',
  ]));
});

router.get('/products/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const bounds = getRangeBounds(normalizeRange(data.range), data.fromDate, data.toDate);
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { orderStatus: 'COMPLETED', ...withDateFilters(bounds.from, bounds.to) } },
    include: { product: true },
  });

  const grouped = new Map<string, { product: string; sku: string; quantitySold: number; grossSales: Prisma.Decimal; discount: Prisma.Decimal; tax: Prisma.Decimal; netSales: Prisma.Decimal }>();
  for (const item of orderItems) {
    const current = grouped.get(item.productId) ?? { product: item.product?.name ?? item.productNameSnapshot, sku: item.product?.sku ?? item.skuSnapshot, quantitySold: 0, grossSales: new Prisma.Decimal(0), discount: new Prisma.Decimal(0), tax: new Prisma.Decimal(0), netSales: new Prisma.Decimal(0) };
    current.quantitySold += item.quantity;
    current.grossSales = current.grossSales.plus(item.originalUnitPrice.mul(item.quantity));
    current.discount = current.discount.plus(item.discount);
    current.tax = current.tax.plus(item.taxAmount);
    current.netSales = current.netSales.plus(item.lineTotal);
    grouped.set(item.productId, current);
  }

  exportCsv(res, 'product-sales-report', ['Product', 'SKU', 'Quantity Sold', 'Gross Sales', 'Discount', 'Tax', 'Net Sales'], Array.from(grouped.values()).map((row) => [row.product, row.sku, row.quantitySold, toNumber(row.grossSales), toNumber(row.discount), toNumber(row.tax), toNumber(row.netSales)]));
});

router.get('/customers/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const bounds = getRangeBounds(normalizeRange(data.range), data.fromDate, data.toDate);
  const orders = await prisma.order.findMany({ where: { orderStatus: 'COMPLETED', customerId: { not: null }, ...withDateFilters(bounds.from, bounds.to) }, include: { customer: true } });
  const grouped = new Map<string, { customer: string; phone: string | null; orderCount: number; totalPurchases: Prisma.Decimal; lastPurchase: Date | null }>();
  for (const order of orders) {
    const key = order.customerId ?? order.customerNameSnapshot ?? 'walk-in';
    const current = grouped.get(key) ?? { customer: order.customer?.name ?? order.customerNameSnapshot ?? 'Walk-in Customer', phone: order.customer?.phone ?? order.customerPhoneSnapshot ?? null, orderCount: 0, totalPurchases: new Prisma.Decimal(0), lastPurchase: null };
    current.orderCount += 1;
    current.totalPurchases = current.totalPurchases.plus(order.grandTotal);
    current.lastPurchase = current.lastPurchase && current.lastPurchase > order.createdAt ? current.lastPurchase : order.createdAt;
    grouped.set(key, current);
  }

  exportCsv(res, 'customer-report', ['Customer', 'Phone', 'Number of Orders', 'Total Purchases', 'Last Purchase'], Array.from(grouped.values()).map((row) => [row.customer, row.phone ?? '', row.orderCount, toNumber(row.totalPurchases), row.lastPurchase ? row.lastPurchase.toISOString() : '']));
});

router.get('/returns/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), search: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const bounds = getRangeBounds(normalizeRange(data.range), data.fromDate, data.toDate);
  const where: Prisma.ReturnWhereInput = {
    ...(data.search ? { OR: [{ returnNumber: { contains: data.search, mode: 'insensitive' } }, { reason: { contains: data.search, mode: 'insensitive' } }] } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };
  const rows = await prisma.return.findMany({ where, include: { originalOrder: true, customer: true, returnItems: true } });
  exportCsv(res, 'returns-report', ['Return Number', 'Original Invoice', 'Customer', 'Date', 'Returned Items', 'Refund Amount', 'Refund Method', 'Status'], rows.map((row) => [row.returnNumber, row.originalOrder.invoiceNumber, row.customer?.name ?? row.originalOrder.customerNameSnapshot ?? 'Walk-in Customer', row.createdAt.toISOString(), row.returnItems.reduce((sum, item) => sum + item.quantity, 0), toNumber(row.refundAmount), row.refundMethod, row.status]));
});

router.get('/purchases/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), supplierId: z.string().optional(), status: z.string().optional(), search: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const bounds = getRangeBounds(normalizeRange(data.range), data.fromDate, data.toDate);
  const where: Prisma.PurchaseWhereInput = {
    ...(data.supplierId ? { supplierId: data.supplierId } : {}),
    ...(data.status ? { status: data.status as any } : {}),
    ...(data.search ? { OR: [{ purchaseNumber: { contains: data.search, mode: 'insensitive' } }, { invoiceNumber: { contains: data.search, mode: 'insensitive' } }, { supplier: { name: { contains: data.search, mode: 'insensitive' } } }] } : {}),
    ...withDateFilters(bounds.from, bounds.to),
  };
  const rows = await prisma.purchase.findMany({ where, include: { supplier: true }, orderBy: { createdAt: 'desc' } });
  exportCsv(res, 'purchase-report', ['Purchase Number', 'Supplier', 'Date', 'Purchase Total', 'Payment Status', 'Payment Method'], rows.map((row) => [row.purchaseNumber, row.supplier?.name ?? 'Unknown Supplier', row.createdAt.toISOString(), toNumber(row.totalAmount), row.status, 'N/A']));
});

router.get('/inventory/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({ category: z.string().optional(), brand: z.string().optional(), supplier: z.string().optional(), stockStatus: z.string().optional() }).safeParse(req.query);
  const data = parsed.success ? parsed.data : {};
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(data.category ? { categoryId: data.category } : {}),
    ...(data.brand ? { brandId: data.brand } : {}),
    ...(data.supplier ? { supplierId: data.supplier } : {}),
    ...(data.stockStatus ? { currentStock: data.stockStatus === 'OUT_OF_STOCK' ? { lte: 0 } : { gt: 0, lte: 5 } } : {}),
  };
  const rows = await prisma.product.findMany({ where, include: { category: true, brand: true, supplier: true }, orderBy: { currentStock: 'asc' } });
  exportCsv(res, 'inventory-report', ['Product', 'SKU', 'Category', 'Current Stock', 'Minimum Stock', 'Purchase Price', 'Selling Price', 'Estimated Stock Value', 'Stock Status'], rows.map((product) => [
    product.name,
    product.sku,
    product.category?.name ?? 'Uncategorized',
    product.currentStock,
    product.minimumStock,
    toNumber(product.purchasePrice),
    toNumber(product.sellingPrice),
    toNumber(new Prisma.Decimal(product.currentStock ?? 0).mul(product.purchasePrice ?? new Prisma.Decimal(0))),
    product.currentStock <= 0 ? 'OUT OF STOCK' : product.currentStock <= product.minimumStock ? 'LOW STOCK' : 'OK',
  ]));
});

router.get('/suppliers/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = z.object({
    search: z.string().optional(),
  }).safeParse(req.query);

  const data = parsed.success ? parsed.data : {};
  const where: Prisma.SupplierWhereInput = data.search
    ? {
        OR: [
          { name: { contains: data.search, mode: 'insensitive' } },
          { phone: { contains: data.search, mode: 'insensitive' } },
          { email: { contains: data.search, mode: 'insensitive' } },
          { gstin: { contains: data.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const suppliers = await prisma.supplier.findMany({
    where,
    include: { purchases: true, products: true },
    orderBy: { createdAt: 'desc' },
  });

  exportCsv(res, 'supplier-report', ['Supplier', 'Phone', 'Email', 'GSTIN', 'Active Products', 'Purchase Count', 'Total Spend', 'Last Purchase'], suppliers.map((supplier) => {
    const totalSpend = supplier.purchases.reduce((sum, purchase) => sum + Number(purchase.totalAmount), 0);
    const lastPurchase = supplier.purchases.length > 0
      ? supplier.purchases.reduce((latest, purchase) => (purchase.createdAt > latest.createdAt ? purchase : latest), supplier.purchases[0])
      : null;

    return [
      supplier.name,
      supplier.phone ?? '',
      supplier.email ?? '',
      supplier.gstin ?? '',
      supplier.products.filter((product) => product.isActive).length,
      supplier.purchases.length,
      totalSpend,
      lastPurchase ? lastPurchase.createdAt.toISOString() : '',
    ];
  }));
});

export default router;

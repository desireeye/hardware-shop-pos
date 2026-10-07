import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const decimalFromNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(value));
};

const decimalSum = (values: Array<Prisma.Decimal | number | string | null | undefined>) => values.reduce((sum, value) => {
  const decimalValue = value === null || value === undefined ? new Prisma.Decimal(0) : new Prisma.Decimal(String(value));
  return sum.plus(decimalValue);
}, new Prisma.Decimal(0));

const normalizeRange = (value: string | undefined) => {
  const normalized = (value ?? 'today').toLowerCase();
  return ['today', 'yesterday', 'this_week', 'this_month', 'custom'].includes(normalized) ? normalized : 'today';
};

const toDateTime = (value: string | undefined, endOfDay = false) => {
  if (!value) return undefined;
  const match = /^\d{4}-\d{2}-\d{2}$/;
  if (!match.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;

  return endOfDay
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
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

  if (range === 'today') {
    return { from: startOfToday, to: endOfToday, rangeName: 'Today' };
  }

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
  const diff = (day === 0 ? -6 : 1 - day);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  if (range === 'this_week') {
    return { from: weekStart, to: endOfToday, rangeName: 'This Week' };
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  if (range === 'this_month') {
    return { from: monthStart, to: endOfToday, rangeName: 'This Month' };
  }

  return { from: startOfToday, to: endOfToday, rangeName: 'Today' };
};

const getCompletedOrderWhere = (from?: Date, to?: Date) => ({
  orderStatus: 'COMPLETED' as const,
  ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
});

const getCompletedReturnWhere = (from?: Date, to?: Date) => ({
  status: 'COMPLETED' as const,
  ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
});

const getOrderAggregate = async (from?: Date, to?: Date) => {
  const orders = await prisma.order.findMany({
    where: getCompletedOrderWhere(from, to),
    include: {
      orderItems: true,
      customer: true,
      payments: true,
      user: true,
    },
  });

  const grossSales = decimalSum(orders.map((order) => order.subtotal));
  const discounts = decimalSum(orders.map((order) => order.discount));
  const taxableSales = decimalSum(orders.map((order) => order.taxableAmount));
  const taxCollected = decimalSum(orders.map((order) => order.cgst.plus(order.sgst).plus(order.igst)));
  const netSales = decimalSum(orders.map((order) => order.grandTotal));

  return {
    orders,
    grossSales,
    discounts,
    taxableSales,
    taxCollected,
    netSales,
    orderCount: orders.length,
    averageOrderValue: orders.length > 0 ? decimalSum(orders.map((order) => order.grandTotal)).div(orders.length) : new Prisma.Decimal(0),
  };
};

const buildTrendSeries = async (from?: Date, to?: Date) => {
  const orderRows = await prisma.order.findMany({
    where: { orderStatus: 'COMPLETED', ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    select: { createdAt: true, grandTotal: true },
    orderBy: { createdAt: 'asc' },
  });

  const labels: string[] = [];
  const values: number[] = [];
  const buckets = new Map<string, Prisma.Decimal>();

  const start = from ?? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const end = to ?? new Date();

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    labels.push(key);
    buckets.set(key, new Prisma.Decimal(0));
  }

  for (const order of orderRows) {
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)!.plus(order.grandTotal));
    }
  }

  for (const label of labels) {
    values.push(toNumber(buckets.get(label) ?? new Prisma.Decimal(0)));
  }

  return { labels, values };
};

router.get('/summary', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({
    range: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }).safeParse(req.query);

  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const fromDate = parsed.success ? parsed.data.fromDate : undefined;
  const toDate = parsed.success ? parsed.data.toDate : undefined;
  const bounds = getRangeBounds(range, fromDate, toDate);

  const [salesOverview, lowStockProducts, recentOrders, recentPurchases, returnSummary, inventorySummary] = await Promise.all([
    getOrderAggregate(bounds.from, bounds.to),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { currentStock: 'asc' },
      take: 50,
      include: { category: true },
    }),
    prisma.order.findMany({
      where: { orderStatus: 'COMPLETED', createdAt: { gte: bounds.from, lte: bounds.to } },
      include: { customer: true, payments: true, orderItems: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.purchase.findMany({
      include: { supplier: true, purchaseItems: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      where: { createdAt: { gte: bounds.from, lte: bounds.to } },
    }),
    prisma.return.aggregate({
      where: getCompletedReturnWhere(bounds.from, bounds.to),
      _count: { id: true },
      _sum: { refundAmount: true },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _count: { id: true },
      _sum: { currentStock: true },
    }),
  ]);

  const lowStockItems = lowStockProducts.filter((product) => product.currentStock <= product.minimumStock && product.currentStock > 0);
  const outOfStockItems = lowStockProducts.filter((product) => product.currentStock <= 0);

  const totalStockValue = await prisma.product.findMany({
    where: { isActive: true },
    select: { currentStock: true, purchasePrice: true },
  });

  const estimatedStockValue = totalStockValue.reduce((sum, product) => {
    const stock = new Prisma.Decimal(product.currentStock ?? 0);
    const purchasePrice = product.purchasePrice ?? new Prisma.Decimal(0);
    return sum.plus(stock.mul(purchasePrice));
  }, new Prisma.Decimal(0));

  const todayReturns = toNumber(returnSummary._sum.refundAmount ?? 0);
  const salesTotal = toNumber(salesOverview.netSales);
  const netSales = salesTotal - todayReturns;

  const trend = await buildTrendSeries(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), bounds.to);

  return res.status(200).json({
    success: true,
    summary: {
      sales: toNumber(salesOverview.netSales),
      orders: salesOverview.orderCount,
      returns: todayReturns,
      netSales,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      estimatedStockValue: toNumber(estimatedStockValue),
      totalActiveProducts: inventorySummary._count.id ?? 0,
      totalStockUnits: inventorySummary._sum.currentStock ?? 0,
    },
    lowStockItems: lowStockItems.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      status: product.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK',
    })),
    outOfStockItems: outOfStockItems.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      status: 'OUT OF STOCK',
    })),
    recentSales: recentOrders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      customer: order.customerNameSnapshot || order.customer?.name || 'Walk-in Customer',
      total: toNumber(order.grandTotal),
      paymentMethod: order.payments?.[0]?.paymentMethod ?? 'N/A',
      createdAt: order.createdAt,
      status: order.orderStatus,
      itemCount: order.orderItems.length,
    })),
    recentPurchases: recentPurchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplier: purchase.supplier?.name ?? 'Unknown Supplier',
      total: toNumber(purchase.totalAmount),
      status: purchase.status,
      createdAt: purchase.createdAt,
      itemCount: purchase.purchaseItems.length,
    })),
    returns: {
      count: returnSummary._count.id ?? 0,
      totalRefundAmount: todayReturns,
      returnedQuantity: await prisma.returnItem.aggregate({
        where: { return: getCompletedReturnWhere(bounds.from, bounds.to) },
        _sum: { quantity: true },
      }).then((result) => result._sum.quantity ?? 0),
    },
    trend,
    range: { value: range, label: bounds.rangeName },
  });
});

router.get('/sales', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);

  const result = await getOrderAggregate(bounds.from, bounds.to);

  return res.status(200).json({
    success: true,
    range: { value: range, label: bounds.rangeName },
    metrics: {
      grossSales: toNumber(result.grossSales),
      discounts: toNumber(result.discounts),
      taxableSales: toNumber(result.taxableSales),
      gstCollected: toNumber(result.taxCollected),
      netSales: toNumber(result.netSales),
      orderCount: result.orderCount,
      averageOrderValue: toNumber(result.averageOrderValue),
    },
    trend: await buildTrendSeries(bounds.from, bounds.to),
  });
});

router.get('/payment-methods', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);

  const rows = await prisma.payment.groupBy({
    by: ['paymentMethod'],
    where: {
      order: {
        orderStatus: 'COMPLETED',
        createdAt: { gte: bounds.from, lte: bounds.to },
      },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  return res.status(200).json({
    success: true,
    rows: rows.map((row) => ({
      paymentMethod: row.paymentMethod,
      transactionCount: row._count.id,
      totalAmount: toNumber(row._sum.amount ?? 0),
    })),
  });
});

router.get('/top-products', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), limit: z.coerce.number().int().min(1).max(20).default(5) }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);
  const limit = parsed.success ? parsed.data.limit : 5;

  const rows = await prisma.orderItem.findMany({
    where: {
      order: { orderStatus: 'COMPLETED', createdAt: { gte: bounds.from, lte: bounds.to } },
    },
    include: { product: true },
  });

  const grouped = rows.reduce<Record<string, any>>((acc, item) => {
    const productId = item.productId;
    if (!acc[productId]) {
      acc[productId] = {
        productId,
        name: item.product?.name ?? item.productNameSnapshot,
        sku: item.product?.sku ?? item.skuSnapshot,
        quantitySold: 0,
        salesAmount: new Prisma.Decimal(0),
      };
    }

    acc[productId].quantitySold += item.quantity;
    acc[productId].salesAmount = acc[productId].salesAmount.plus(item.lineTotal);
    return acc;
  }, {});

  const data = Object.values(grouped)
    .sort((a, b) => b.quantitySold - a.quantitySold || Number(b.salesAmount) - Number(a.salesAmount))
    .slice(0, limit)
    .map((item) => ({
      productName: item.name,
      sku: item.sku,
      quantitySold: item.quantitySold,
      salesAmount: toNumber(item.salesAmount),
    }));

  return res.status(200).json({ success: true, products: data });
});

router.get('/top-customers', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), limit: z.coerce.number().int().min(1).max(20).default(5) }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);
  const limit = parsed.success ? parsed.data.limit : 5;

  const orders = await prisma.order.findMany({
    where: {
      orderStatus: 'COMPLETED',
      customerId: { not: null },
      createdAt: { gte: bounds.from, lte: bounds.to },
    },
    include: { customer: true },
  });

  const grouped = new Map<string, { customerName: string; phone: string | null; orderCount: number; totalPurchaseAmount: Prisma.Decimal }>();

  for (const order of orders) {
    const key = order.customerId ?? `${order.customerNameSnapshot ?? 'walkin'}-${order.customerPhoneSnapshot ?? ''}`;
    const existing = grouped.get(key) ?? {
      customerName: order.customer?.name ?? order.customerNameSnapshot ?? 'Walk-in Customer',
      phone: order.customer?.phone ?? order.customerPhoneSnapshot ?? null,
      orderCount: 0,
      totalPurchaseAmount: new Prisma.Decimal(0),
    };

    existing.orderCount += 1;
    existing.totalPurchaseAmount = existing.totalPurchaseAmount.plus(order.grandTotal);
    grouped.set(key, existing);
  }

  const data = Array.from(grouped.values())
    .filter((customer) => customer.customerName.toLowerCase() !== 'walk-in customer')
    .sort((a, b) => b.orderCount - a.orderCount || Number(b.totalPurchaseAmount) - Number(a.totalPurchaseAmount))
    .slice(0, limit)
    .map((customer) => ({
      customerName: customer.customerName,
      phone: customer.phone,
      orderCount: customer.orderCount,
      totalPurchaseAmount: toNumber(customer.totalPurchaseAmount),
    }));

  return res.status(200).json({ success: true, customers: data });
});

router.get('/returns', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);

  const rows = await prisma.return.findMany({
    where: getCompletedReturnWhere(bounds.from, bounds.to),
    include: { returnItems: true },
  });

  const totalRefund = decimalSum(rows.map((row) => row.refundAmount));
  const returnedQuantity = rows.reduce((sum, row) => sum + row.returnItems.reduce((count, item) => count + item.quantity, 0), 0);

  const refundBreakdown = await prisma.return.groupBy({
    by: ['refundMethod'],
    where: getCompletedReturnWhere(bounds.from, bounds.to),
    _count: { id: true },
    _sum: { refundAmount: true },
  });

  return res.status(200).json({
    success: true,
    summary: {
      count: rows.length,
      totalRefundAmount: toNumber(totalRefund),
      returnedQuantity,
    },
    refundMethodBreakdown: refundBreakdown.map((row) => ({
      refundMethod: row.refundMethod,
      count: row._count.id,
      total: toNumber(row._sum.refundAmount ?? 0),
    })),
  });
});

router.get('/purchases', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const parsed = z.object({ range: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }).safeParse(req.query);
  const range = normalizeRange(parsed.success ? parsed.data.range : 'today');
  const bounds = getRangeBounds(range, parsed.success ? parsed.data.fromDate : undefined, parsed.success ? parsed.data.toDate : undefined);

  const purchases = await prisma.purchase.findMany({
    where: { createdAt: { gte: bounds.from, lte: bounds.to } },
    include: { supplier: true },
  });

  const totalPurchases = decimalSum(purchases.map((purchase) => purchase.totalAmount));
  const paidAmount = decimalSum(purchases.map((purchase) => purchase.paidAmount));
  const pendingAmount = decimalSum(purchases.map((purchase) => purchase.totalAmount.minus(purchase.paidAmount)));
  const supplierCount = new Set(purchases.map((purchase) => purchase.supplierId)).size;

  return res.status(200).json({
    success: true,
    summary: {
      totalPurchases: purchases.length,
      totalAmount: toNumber(totalPurchases),
      paidAmount: toNumber(paidAmount),
      pendingAmount: toNumber(pendingAmount),
      supplierCount,
    },
  });
});

router.get('/stock', requireAuth, requireRole('ADMIN', 'STAFF'), async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true, brand: true, supplier: true },
    orderBy: { currentStock: 'asc' },
  });

  const totalActiveProducts = products.length;
  const totalStockUnits = products.reduce((sum, product) => sum + product.currentStock, 0);
  const lowStockProducts = products.filter((product) => product.currentStock <= product.minimumStock && product.currentStock > 0);
  const outOfStockProducts = products.filter((product) => product.currentStock <= 0);

  const estimatedStockValue = products.reduce((sum, product) => {
    const stock = new Prisma.Decimal(product.currentStock ?? 0);
    const price = product.purchasePrice ?? new Prisma.Decimal(0);
    return sum.plus(stock.mul(price));
  }, new Prisma.Decimal(0));

  return res.status(200).json({
    success: true,
    summary: {
      totalActiveProducts,
      totalStockUnits,
      lowStockProducts: lowStockProducts.length,
      outOfStockProducts: outOfStockProducts.length,
      estimatedStockValue: toNumber(estimatedStockValue),
    },
    lowStockItems: products.filter((product) => product.currentStock <= product.minimumStock).map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      status: product.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK',
    })).sort((a, b) => a.currentStock - b.currentStock),
  });
});

export default router;

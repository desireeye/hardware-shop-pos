import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Product and inventory management', () => {
  const adminEmail = 'product-admin@example.com';
  const staffEmail = 'product-staff@example.com';
  const productSku = `HSP-DELUXE-${Date.now()}`;
  const productBarcode = `8901234567890${Date.now()}`;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' },
    });

    const staffRole = await prisma.role.upsert({
      where: { name: 'STAFF' },
      update: {},
      create: { name: 'STAFF' },
    });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Product Admin',
        email: adminEmail,
        passwordHash: await hashPassword('StrongPass123!'),
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    await prisma.user.upsert({
      where: { email: staffEmail },
      update: {},
      create: {
        name: 'Product Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [adminEmail, staffEmail] },
      },
    });

    await prisma.payment.deleteMany({
      where: {
        order: {
          orderItems: {
            some: {
              product: {
                sku: productSku,
              },
            },
          },
        },
      },
    });

    await prisma.orderItem.deleteMany({
      where: {
        product: {
          sku: productSku,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        orderItems: {
          some: {
            product: {
              sku: productSku,
            },
          },
        },
      },
    });

    await prisma.inventoryTransaction.deleteMany({
      where: {
        product: {
          sku: productSku,
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        sku: productSku,
      },
    });

    await prisma.$disconnect();
  });

  it('allows an admin to create a product with valid details', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/products')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Heavy Duty Drill Bit',
        sku: productSku,
        barcode: productBarcode,
        unit: 'PCS',
        purchasePrice: 420,
        sellingPrice: 560,
        mrp: 620,
        gstRate: 18,
        hsnCode: '8207',
        currentStock: 25,
        minimumStock: 10,
        description: 'Industrial drill bit set',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.product.sku).toBe(productSku);
    expect(response.body.product.currentStock).toBe(25);
  });

  it('rejects duplicate sku or barcode values', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const duplicateSkuResponse = await request(app)
      .post('/api/products')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Duplicate SKU Product',
        sku: productSku,
        unit: 'PCS',
        purchasePrice: 100,
        sellingPrice: 120,
        mrp: 140,
        gstRate: 5,
        currentStock: 5,
        minimumStock: 2,
      });

    const duplicateBarcodeResponse = await request(app)
      .post('/api/products')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Duplicate Barcode Product',
        sku: 'HSP-UNIQUE-200',
        barcode: productBarcode,
        unit: 'PCS',
        purchasePrice: 100,
        sellingPrice: 120,
        mrp: 140,
        gstRate: 5,
        currentStock: 5,
        minimumStock: 2,
      });

    expect(duplicateSkuResponse.status).toBe(409);
    expect(duplicateBarcodeResponse.status).toBe(409);
  });

  it('allows admin stock-in and stock adjustment transactions', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const stockInResponse = await request(app)
      .post('/api/products/stock')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        sku: productSku,
        type: 'STOCK_IN',
        quantity: 12,
        reason: 'Restock from supplier',
        unitCost: 420,
      });

    const adjustResponse = await request(app)
      .post('/api/products/stock')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        sku: productSku,
        type: 'ADJUSTMENT',
        quantity: -3,
        reason: 'Damaged during handling',
      });

    expect(stockInResponse.status).toBe(200);
    expect(stockInResponse.body.product.currentStock).toBe(37);
    expect(adjustResponse.status).toBe(200);
    expect(adjustResponse.body.product.currentStock).toBe(34);
  });

  it('detects low-stock items and blocks staff product creation', async () => {
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const staffLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'StaffPass123!' });

    const lowStockResponse = await request(app)
      .get('/api/products/low-stock')
      .set('Cookie', adminLoginResponse.headers['set-cookie'][0]);

    const staffCreateResponse = await request(app)
      .post('/api/products')
      .set('Cookie', staffLoginResponse.headers['set-cookie'][0])
      .send({
        name: 'Forbidden Staff Product',
        sku: 'HSP-FORBIDDEN-001',
        unit: 'PCS',
        purchasePrice: 100,
        sellingPrice: 120,
        mrp: 135,
        gstRate: 5,
        currentStock: 5,
        minimumStock: 4,
      });

    expect(lowStockResponse.status).toBe(200);
    expect(Array.isArray(lowStockResponse.body.products)).toBe(true);
    expect(staffCreateResponse.status).toBe(403);
  });

  it('creates a checkout order and deducts stock in one atomic sale transaction', async () => {
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const product = await prisma.product.findUnique({
      where: { sku: productSku },
      select: { id: true, name: true, sellingPrice: true, currentStock: true, gstRate: true },
    });

    expect(product).not.toBeNull();

    const response = await request(app)
      .post('/api/sales/checkout')
      .set('Cookie', adminLoginResponse.headers['set-cookie'][0])
      .send({
        customerName: 'Walk-in Customer',
        customerPhone: '9876543210',
        paymentMethod: 'CASH',
        amountPaid: 1200,
        discountAmount: 20,
        items: [
          {
            productId: product!.id,
            quantity: 2,
            unitPrice: Number(product!.sellingPrice),
            discountAmount: 20,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.order.invoiceNumber).toMatch(/HSH-/i);
    expect(response.body.order.orderStatus).toBe('COMPLETED');
    expect(response.body.order.paymentStatus).toBe('PAID');
    expect(response.body.order.grandTotal).toBeGreaterThan(0);
    expect(response.body.order.items).toHaveLength(1);
    expect(response.body.order.items[0].quantity).toBe(2);
    expect(response.body.order.items[0].lineTotal).toBeGreaterThan(0);
    expect(response.body.stockUpdated).toBe(true);
  });
});

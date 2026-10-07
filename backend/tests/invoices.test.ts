import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { amountToWords } from '../src/utils/amountToWords.js';

describe('Invoice billing and order history', () => {
  const adminEmail = 'invoice-admin@example.com';
  const staffEmail = 'invoice-staff@example.com';
  const productSku = `INV-PROD-${Date.now()}`;
  let orderId = '';

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Invoice Admin',
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
        name: 'Invoice Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'PVC Pipe 1 inch',
        sku: productSku,
        unit: 'PCS',
        purchasePrice: 200,
        sellingPrice: 500,
        mrp: 550,
        gstRate: 18,
        currentStock: 25,
        minimumStock: 5,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        name: 'Rahul Sharma',
        phone: '9876543210',
        address: 'Old Address',
      },
    });

    const order = await prisma.order.create({
      data: {
        invoiceNumber: 'INV-2026-000123',
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id,
        customerId: customer.id,
        customerNameSnapshot: 'Rahul Sharma',
        customerPhoneSnapshot: '9876543210',
        customerAddressSnapshot: 'Old Address',
        subtotal: 1000,
        discount: 50,
        taxableAmount: 950,
        cgst: 85.5,
        sgst: 85.5,
        igst: 0,
        grandTotal: 1121,
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
      } as any,
    });

    orderId = order.id;

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: 2,
        originalUnitPrice: 500,
        actualUnitPrice: 475,
        discount: 50,
        gstRate: 18,
        taxableAmount: 900,
        cgst: 81,
        sgst: 81,
        igst: 0,
        taxAmount: 162,
        lineTotal: 1062,
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'UPI',
        amount: 1121,
        status: 'PAID',
        referenceNo: 'UPI-REF-1001',
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: { orderId: orderId },
    });

    await prisma.orderItem.deleteMany({
      where: { orderId: orderId },
    });

    await prisma.order.deleteMany({
      where: { id: orderId },
    });

    await prisma.customer.deleteMany({
      where: { phone: '9876543210' },
    });

    await prisma.product.deleteMany({
      where: { sku: productSku },
    });

    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, staffEmail] } },
    });

    await prisma.$disconnect();
  });

  it('returns an invoice for an authenticated user', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .get(`/api/orders/${orderId}/invoice`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.invoice.invoiceNumber).toBe('INV-2026-000123');
    expect(response.body.invoice.customer.name).toBe('Rahul Sharma');
    expect(response.body.invoice.items).toHaveLength(1);
  });

  it('rejects unauthenticated invoice access', async () => {
    const response = await request(app).get(`/api/orders/${orderId}/invoice`);
    expect(response.status).toBe(401);
  });

  it('returns a 404 for a missing invoice order', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .get('/api/orders/not-real/invoice')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(404);
  });

  it('converts Indian rupees to words correctly', () => {
    expect(amountToWords(0)).toMatch(/zero/i);
    expect(amountToWords(1250)).toMatch(/twelve hundred fifty/i);
    expect(amountToWords(100.5)).toMatch(/hundred/i);
  });
});

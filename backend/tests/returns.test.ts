import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Returns and refunds', () => {
  const adminEmail = `returns-admin-${Date.now()}@example.com`;
  const productSku = `RET-${Date.now()}`;
  const invoiceNumber = `RET-INV-${Date.now()}`;
  let adminId = '';
  let productId = '';
  let orderId = '';
  let orderItemId = '';
  let originalGrandTotal = 0;
  let originalStock = 0;
  let returnId = '';

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });

    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Returns Admin',
        email: adminEmail,
        passwordHash: await hashPassword('StrongPass123!'),
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    adminId = user.id;

    const product = await prisma.product.create({
      data: {
        name: 'Return Test Hammer',
        sku: productSku,
        unit: 'PCS',
        purchasePrice: 100,
        sellingPrice: 250,
        mrp: 260,
        gstRate: 18,
        currentStock: 10,
        minimumStock: 2,
      },
    });

    productId = product.id;
    originalStock = product.currentStock;

    const order = await prisma.order.create({
      data: {
        invoiceNumber,
        userId: adminId,
        customerNameSnapshot: 'Return Customer',
        customerPhoneSnapshot: '9876543210',
        subtotal: 500,
        discount: 0,
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        igst: 0,
        grandTotal: 590,
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
      },
    });

    orderId = order.id;
    originalGrandTotal = Number(order.grandTotal);

    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: 2,
        originalUnitPrice: 250,
        actualUnitPrice: 250,
        discount: 0,
        gstRate: 18,
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        igst: 0,
        taxAmount: 90,
        lineTotal: 590,
      },
    });

    orderItemId = item.id;

    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'CASH',
        amount: 590,
        status: 'PAID',
        referenceNo: 'RET-PAY-1',
      },
    });
  });

  afterAll(async () => {
    await prisma.returnItem.deleteMany({ where: { productId } });
    await prisma.return.deleteMany({ where: { originalOrderId: orderId } });
    await prisma.inventoryTransaction.deleteMany({ where: { productId } });
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { id: adminId } });
    await prisma.$disconnect();
  });

  it('creates a valid return and restores stock without altering the original order', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/returns')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        orderId,
        refundMethod: 'CASH',
        reason: 'Damaged during handling',
        idempotencyKey: 'return-test-1',
        items: [
          {
            orderItemId,
            quantity: 1,
            reason: 'Damaged item',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.return.refundAmount).toBeGreaterThan(0);
    expect(response.body.return.items).toHaveLength(1);

    const persistedReturn = await prisma.return.findUnique({ where: { id: response.body.return.id } });
    expect(persistedReturn).not.toBeNull();
    expect(persistedReturn?.status).toBe('COMPLETED');

    const originalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(Number(originalOrder!.grandTotal)).toBe(originalGrandTotal);

    const updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(updatedProduct?.currentStock).toBe(originalStock + 1);

    const inventoryEntry = await prisma.inventoryTransaction.findFirst({
      where: { referenceType: 'Return', referenceId: response.body.return.id },
    });
    expect(inventoryEntry).not.toBeNull();
    expect(inventoryEntry?.type).toBe('RETURN');

    returnId = response.body.return.id;
  });

  it('prevents duplicate returns using the same idempotency key', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/returns')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        orderId,
        refundMethod: 'CASH',
        reason: 'Duplicate attempt',
        idempotencyKey: 'return-test-1',
        items: [
          {
            orderItemId,
            quantity: 1,
            reason: 'Duplicate attempt',
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('DUPLICATE_RETURN');
  });
});

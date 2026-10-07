import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Orders and sales history', () => {
  const adminEmail = `orders-admin-${Date.now()}@example.com`;
  const staffEmail = `orders-staff-${Date.now()}@example.com`;
  const productSku = `OH-PROD-${Date.now()}`;
  const invoiceNumber = `INV-SHOP-${Date.now()}`;
  let orderId = '';
  let productId = '';
  let customerId = '';

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Orders Admin',
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
        name: 'Orders Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Order Drill Bit',
        sku: productSku,
        unit: 'PCS',
        purchasePrice: 250,
        sellingPrice: 500,
        mrp: 550,
        gstRate: 18,
        currentStock: 15,
        minimumStock: 3,
      },
    });

    productId = product.id;

    const customer = await prisma.customer.create({
      data: {
        name: 'Rahul Sharma',
        phone: '9999999999',
        address: 'Old Market Road',
      },
    });

    customerId = customer.id;

    const order = await prisma.order.create({
      data: {
        invoiceNumber,
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id,
        customerId: customer.id,
        customerNameSnapshot: 'Rahul Sharma',
        customerPhoneSnapshot: '9999999999',
        customerAddressSnapshot: 'Old Market Road',
        subtotal: 450,
        discount: 0,
        taxableAmount: 450,
        cgst: 40.5,
        sgst: 40.5,
        igst: 0,
        grandTotal: 531,
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
        quantity: 1,
        originalUnitPrice: 500,
        actualUnitPrice: 450,
        discount: 0,
        gstRate: 18,
        taxableAmount: 450,
        cgst: 40.5,
        sgst: 40.5,
        igst: 0,
        taxAmount: 81,
        lineTotal: 531,
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'UPI',
        amount: 531,
        status: 'PAID',
        referenceNo: 'REF-ORD-1',
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orderId: orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, staffEmail] } } });
    await prisma.$disconnect();
  });

  it('allows an authenticated user to list orders', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .get('/api/orders?page=1&pageSize=10')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.orders.length).toBeGreaterThan(0);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it('rejects unauthenticated order access', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('supports invoice, customer, product search and pagination', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const invoiceSearch = await request(app)
      .get(`/api/orders?search=${encodeURIComponent(invoiceNumber)}&page=1&pageSize=10`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(invoiceSearch.status).toBe(200);
    expect(invoiceSearch.body.orders.some((order: any) => order.invoiceNumber === invoiceNumber)).toBe(true);

    const customerSearch = await request(app)
      .get('/api/orders?search=Rahul&page=1&pageSize=10')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(customerSearch.status).toBe(200);
    expect(customerSearch.body.orders.some((order: any) => order.customerName === 'Rahul Sharma')).toBe(true);

    const productSearch = await request(app)
      .get('/api/orders?search=Order%20Drill%20Bit&page=1&pageSize=10')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(productSearch.status).toBe(200);
    expect(productSearch.body.orders.length).toBeGreaterThan(0);
    expect(productSearch.body.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('supports status, payment and date filters and rejects invalid ranges', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const statusFilter = await request(app)
      .get('/api/orders?status=COMPLETED&paymentMethod=UPI&page=1&pageSize=10')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(statusFilter.status).toBe(200);
    expect(statusFilter.body.orders.every((order: any) => order.orderStatus === 'COMPLETED')).toBe(true);
    expect(statusFilter.body.orders.every((order: any) => order.paymentMethod === 'UPI')).toBe(true);

    const fromDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10);
    const toDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 10);

    const dateFilter = await request(app)
      .get(`/api/orders?fromDate=${fromDate}&toDate=${toDate}&page=1&pageSize=10`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(dateFilter.status).toBe(200);
    expect(dateFilter.body.orders.some((order: any) => order.invoiceNumber === invoiceNumber)).toBe(true);

    const invalidRange = await request(app)
      .get(`/api/orders?fromDate=${toDate}&toDate=${fromDate}&page=1&pageSize=10`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(invalidRange.status).toBe(400);
  });

  it('returns the historical order detail and remains read-only on view', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const beforeOrderCount = await prisma.order.count();
    const beforePaymentCount = await prisma.payment.count();
    const beforeInventoryCount = await prisma.inventoryTransaction.count();

    await prisma.customer.update({
      where: { id: customerId },
      data: { name: 'Rahul Kumar', phone: '8888888888' },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { sellingPrice: 600, mrp: 650 },
    });

    const response = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(200);
    expect(response.body.order.customer.name).toBe('Rahul Sharma');
    expect(response.body.order.customer.phone).toBe('9999999999');
    expect(response.body.order.items[0].actualUnitPrice).toBe(450);
    expect(response.body.order.items[0].originalUnitPrice).toBe(500);

    const afterOrderCount = await prisma.order.count();
    const afterPaymentCount = await prisma.payment.count();
    const afterInventoryCount = await prisma.inventoryTransaction.count();

    expect(afterOrderCount).toBe(beforeOrderCount);
    expect(afterPaymentCount).toBe(beforePaymentCount);
    expect(afterInventoryCount).toBe(beforeInventoryCount);
  });
});

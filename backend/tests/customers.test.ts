import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Customer management', () => {
  const adminEmail = `customer-admin-${Date.now()}@example.com`;
  const staffEmail = `customer-staff-${Date.now()}@example.com`;
  const productSku = `CUS-PROD-${Date.now()}`;
  const customerName = `Rahul Sharma ${Date.now()}`;
  const customerPhone = `98${Date.now().toString().slice(-8)}`;
  let customerId = '';
  let customerOrderId = '';

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Customer Admin',
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
        name: 'Customer Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Customer Test Product',
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
        name: customerName,
        phone: customerPhone,
        address: 'Old Address',
      },
    });

    customerId = customer.id;

    const order = await prisma.order.create({
      data: {
        invoiceNumber: `CUST-INV-${Date.now()}`,
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id,
        customerId: customer.id,
        customerNameSnapshot: customerName,
        customerPhoneSnapshot: customerPhone,
        customerAddressSnapshot: 'Old Address',
        subtotal: 1000,
        discount: 0,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        grandTotal: 1180,
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
      },
    });

    customerOrderId = order.id;

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: 2,
        originalUnitPrice: 500,
        actualUnitPrice: 500,
        discount: 0,
        gstRate: 18,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        taxAmount: 180,
        lineTotal: 1180,
      },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'UPI',
        amount: 1180,
        status: 'PAID',
        referenceNo: 'REF-CUST-1',
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: { orderId: customerOrderId },
    });

    await prisma.orderItem.deleteMany({
      where: { orderId: customerOrderId },
    });

    await prisma.order.deleteMany({
      where: { id: customerOrderId },
    });

    await prisma.customer.deleteMany({
      where: { id: customerId },
    });

    await prisma.product.deleteMany({
      where: { sku: productSku },
    });

    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, staffEmail] } },
    });

    await prisma.$disconnect();
  });

  it('authenticated user can list customers', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .get('/api/customers')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.customers.length).toBeGreaterThan(0);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it('rejects unauthenticated customer access', async () => {
    const response = await request(app).get('/api/customers');
    expect(response.status).toBe(401);
  });

  it('creates a customer with valid data', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const uniquePhone = `9${Date.now().toString().slice(-9)}`;

    const response = await request(app)
      .post('/api/customers')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: '  Amit Kumar  ',
        phone: uniquePhone,
        address: '  Sector 12, Jaipur  ',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.customer.name).toBe('Amit Kumar');
    expect(response.body.customer.phone).toBe(uniquePhone);
  });

  it('rejects invalid customer data', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/customers')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: '',
        phone: 'bad-phone',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('updates customer details and rejects duplicate phone', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const customer = await prisma.customer.create({
      data: {
        name: 'Duplicate Phone Customer',
        phone: `999${Date.now().toString().slice(-7)}`,
        address: 'First address',
      },
    });

    const updateResponse = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({ name: 'Updated Customer', phone: '9876543210' });

    expect(updateResponse.status).toBe(409);

    const validUpdatePhone = `9${Date.now().toString().slice(-9)}`;

    const validUpdateResponse = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({ name: 'Updated Customer', phone: validUpdatePhone, address: 'Second address' });

    expect(validUpdateResponse.status).toBe(200);
    expect(validUpdateResponse.body.customer.phone).toBe(validUpdatePhone);

    await prisma.customer.delete({ where: { id: customer.id } });
  });

  it('returns a 404 for a missing customer and supports search pagination', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const missing = await request(app)
      .get('/api/customers/nope')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(missing.status).toBe(404);

    const searchResponse = await request(app)
      .get(`/api/customers?search=${encodeURIComponent(customerName)}&page=1&pageSize=10`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.customers.some((customer: any) => customer.name.toLowerCase().includes('rahul'))).toBe(true);

    const phoneSearch = await request(app)
      .get(`/api/customers?search=${encodeURIComponent(customerPhone)}&page=1&pageSize=10`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(phoneSearch.status).toBe(200);
    expect(phoneSearch.body.customers.some((customer: any) => customer.phone === customerPhone)).toBe(true);
  });

  it('returns customer detail statistics and purchase history', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(200);
    expect(response.body.customer.totalOrders).toBeGreaterThanOrEqual(1);
    expect(response.body.customer.totalPurchases).toBeGreaterThanOrEqual(1000);
    expect(response.body.customer.lastPurchaseAt).toBeTruthy();
    expect(response.body.purchaseHistory.length).toBeGreaterThan(0);
  });

  it('keeps historical invoice data unchanged after customer edit', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    await request(app)
      .patch(`/api/customers/${customerId}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({ name: 'Rahul Kumar', phone: '8888888888', address: 'New Address' });

    const invoiceResponse = await request(app)
      .get(`/api/orders/${customerOrderId}/invoice`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(invoiceResponse.status).toBe(200);
    expect(invoiceResponse.body.invoice.customer.name).toBe(customerName);
    expect(invoiceResponse.body.invoice.customer.phone).toBe(customerPhone);
    expect(invoiceResponse.body.invoice.customer.address).toBe('Old Address');
  });

  it('does not hard delete customers with order history', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .delete(`/api/customers/${customerId}`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(response.status).toBe(409);
  });
});

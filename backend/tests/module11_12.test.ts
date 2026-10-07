import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Module 11 and 12 validation', () => {
  const adminEmail = 'advanced-admin@example.com';
  const staffEmail = 'advanced-staff@example.com';
  const productSku = `ADV-SEARCH-${Date.now()}`;
  const productBarcode = `890111111${Date.now()}`;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Advanced Admin',
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
        name: 'Advanced Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    await prisma.product.upsert({
      where: { sku: productSku },
      update: {},
      create: {
        name: 'Heavy Duty Drill Bit',
        sku: productSku,
        barcode: productBarcode,
        unit: 'PCS',
        purchasePrice: 200,
        sellingPrice: 300,
        mrp: 350,
        gstRate: 18,
        hsnCode: '8207',
        currentStock: 3,
        minimumStock: 5,
        description: 'Advanced search test product',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { sku: { startsWith: 'ADV-SEARCH-' } } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, staffEmail] } } });
    await prisma.$disconnect();
  });

  it('supports case-insensitive product search and low-stock filtering', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'StrongPass123!' });

    const nameSearch = await request(app)
      .get('/api/products')
      .query({ search: 'drill bit', page: 1, pageSize: 10 })
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    const skuSearch = await request(app)
      .get('/api/products')
      .query({ search: productSku.toLowerCase(), page: 1, pageSize: 10 })
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    const lowStock = await request(app)
      .get('/api/products/low-stock')
      .query({ status: 'LOW_STOCK', page: 1, pageSize: 10 })
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    expect(nameSearch.status).toBe(200);
    expect(nameSearch.body.success).toBe(true);
    expect(nameSearch.body.products.some((product: any) => product.name.toLowerCase().includes('drill'))).toBe(true);

    expect(skuSearch.status).toBe(200);
    expect(skuSearch.body.success).toBe(true);
    expect(skuSearch.body.products.some((product: any) => product.sku === productSku)).toBe(true);

    expect(lowStock.status).toBe(200);
    expect(lowStock.body.success).toBe(true);
    expect(lowStock.body.products.some((product: any) => product.sku === productSku)).toBe(true);
  });

  it('allows admin settings updates and blocks staff updates', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'StrongPass123!' });
    const staffLogin = await request(app).post('/api/auth/login').send({ email: staffEmail, password: 'StaffPass123!' });

    const readSettings = await request(app).get('/api/settings').set('Cookie', adminLogin.headers['set-cookie'][0]);

    const adminUpdate = await request(app)
      .put('/api/settings')
      .set('Cookie', adminLogin.headers['set-cookie'][0])
      .send({ shopName: 'Hammer & Hardware', shopPhone: '9999999999', shopEmail: 'sales@hammerhardware.local', defaultPageSize: 25 });

    const staffUpdate = await request(app)
      .put('/api/settings')
      .set('Cookie', staffLogin.headers['set-cookie'][0])
      .send({ shopName: 'Should Not Change' });

    expect(readSettings.status).toBe(200);
    expect(readSettings.body.success).toBe(true);
    expect(adminUpdate.status).toBe(200);
    expect(adminUpdate.body.success).toBe(true);
    expect(staffUpdate.status).toBe(403);
  });
});

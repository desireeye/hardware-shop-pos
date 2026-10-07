import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Module 13 and 14 export and security checks', () => {
  const adminEmail = 'module13-admin@example.com';
  const staffEmail = 'module13-staff@example.com';
  const supplierName = `Export Supplier ${Date.now()}`;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Module 13 Admin',
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
        name: 'Module 13 Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    await prisma.supplier.create({
      data: {
        name: supplierName,
        phone: '9000000000',
        email: 'supplier@example.com',
        address: 'Export test address',
        gstin: '29ABCDE1234F1Z5',
      },
    });
  });

  afterAll(async () => {
    await prisma.supplier.deleteMany({ where: { name: { contains: 'Export Supplier' } } });
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, staffEmail] } } });
    await prisma.$disconnect();
  });

  it('exports supplier records without leaking sensitive data', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'StrongPass123!' });
    const staffLogin = await request(app).post('/api/auth/login').send({ email: staffEmail, password: 'StaffPass123!' });

    const adminReport = await request(app)
      .get('/api/reports/suppliers')
      .query({ page: 1, pageSize: 20 })
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    const adminExport = await request(app)
      .get('/api/reports/suppliers/export')
      .query({ page: 1, pageSize: 20 })
      .set('Cookie', adminLogin.headers['set-cookie'][0]);

    const staffAccess = await request(app)
      .get('/api/reports/suppliers')
      .set('Cookie', staffLogin.headers['set-cookie'][0]);

    expect(adminReport.status).toBe(200);
    expect(adminReport.body.success).toBe(true);
    expect(adminReport.body.rows.some((row: any) => row.name === supplierName)).toBe(true);

    expect(adminExport.status).toBe(200);
    expect(adminExport.headers['content-type']).toContain('text/csv');
    expect(adminExport.text).toContain(supplierName);
    expect(adminExport.text).not.toContain('DATABASE_URL');
    expect(adminExport.text).not.toContain('password');

    expect(staffAccess.status).toBe(403);
  });
});

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Supplier and stock purchase management', () => {
  const adminEmail = 'supplier-admin@example.com';
  const supplierName = `Apex Industrial ${Date.now()}`;
  const productSku = `PURCHASE-SKU-${Date.now()}`;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' },
    });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Supplier Admin',
        email: adminEmail,
        passwordHash: await hashPassword('StrongPass123!'),
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.purchaseItem.deleteMany({
      where: {
        product: {
          sku: productSku,
        },
      },
    });

    await prisma.purchase.deleteMany({
      where: {
        supplier: {
          name: supplierName,
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

    await prisma.supplier.deleteMany({
      where: {
        name: supplierName,
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: adminEmail,
      },
    });

    await prisma.$disconnect();
  });

  it('creates a supplier and records a stock purchase that increases inventory', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const supplierResponse = await request(app)
      .post('/api/suppliers')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: supplierName,
        phone: '9876543210',
        email: 'vendor@example.com',
        address: 'Industrial Area',
        gstin: '29ABCDE1234F1Z5',
      });

    const supplierId = supplierResponse.body.supplier.id;

    const productResponse = await request(app)
      .post('/api/products')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Purchase Test Product',
        sku: productSku,
        unit: 'PCS',
        purchasePrice: 90,
        sellingPrice: 140,
        mrp: 150,
        gstRate: 18,
        currentStock: 0,
        minimumStock: 5,
        supplierId,
      });

    const productId = productResponse.body.product.id;

    const purchaseResponse = await request(app)
      .post('/api/purchases')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        supplierId,
        invoiceNumber: `PO-${Date.now()}`,
        notes: 'Bulk stock purchase',
        items: [
          {
            productId,
            quantity: 15,
            unitCost: 90,
            taxRate: 18,
          },
        ],
      });

    const purchaseId = purchaseResponse.body.purchase.id;

    expect(supplierResponse.status).toBe(201);
    expect(purchaseResponse.status).toBe(201);
    expect(purchaseResponse.body.success).toBe(true);
    expect(purchaseResponse.body.purchase.totalAmount).toBeGreaterThan(0);
    expect(purchaseResponse.body.purchase.items).toHaveLength(1);

    const inventoryResponse = await request(app)
      .get('/api/products')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    const targetProduct = inventoryResponse.body.products.find((product: any) => product.id === productId);
    expect(targetProduct.currentStock).toBe(15);

    const supplierPurchasesResponse = await request(app)
      .get(`/api/suppliers/${supplierId}/purchases`)
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(supplierPurchasesResponse.status).toBe(200);
    expect(supplierPurchasesResponse.body.purchases.some((purchase: any) => purchase.id === purchaseId)).toBe(true);
  });
});

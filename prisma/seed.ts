import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
    },
  });

  const staffRole = await prisma.role.create({
    data: {
      name: 'STAFF',
    },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Shop Owner',
      email: 'admin@example.com',
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Plumbing', description: 'Pipes, fittings, and plumbing accessories' } }),
    prisma.category.create({ data: { name: 'Electrical', description: 'Wires, switches, lights, and electrical accessories' } }),
    prisma.category.create({ data: { name: 'Tools', description: 'Hand tools and power tools' } }),
    prisma.category.create({ data: { name: 'Paint', description: 'Paint, coatings, and finishing products' } }),
    prisma.category.create({ data: { name: 'Hardware', description: 'Fasteners and general hardware' } }),
    prisma.category.create({ data: { name: 'Adhesives', description: 'Construction and general adhesives' } }),
  ]);

  const brands = await Promise.all([
    prisma.brand.create({ data: { name: 'Bosch' } }),
    prisma.brand.create({ data: { name: 'Asian Paints' } }),
    prisma.brand.create({ data: { name: 'Dr. Fixit' } }),
    prisma.brand.create({ data: { name: 'Havells' } }),
    prisma.brand.create({ data: { name: 'Finolex' } }),
  ]);

  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'Metro Supply Co.',
        phone: '+91 9876543210',
        email: 'sales@metrosupply.in',
        address: 'Bengaluru, Karnataka',
        gstin: '29ABCDE1234F1Z5',
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Prime Electrics',
        phone: '+91 9123456780',
        email: 'support@primeelectrics.in',
        address: 'Mumbai, Maharashtra',
        gstin: '27ABCDE5678F1Z3',
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Toolline Traders',
        phone: '+91 9988776655',
        email: 'team@toollinetraders.in',
        address: 'Delhi, Delhi',
        gstin: '07ABCDE3456F1Z8',
      },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'PVC Pipe 1 inch',
        sku: 'PVC-PIPE-1',
        barcode: '890123456001',
        categoryId: categories[0].id,
        brandId: brands[4].id,
        supplierId: suppliers[0].id,
        unit: 'piece',
        purchasePrice: '180.00',
        sellingPrice: '240.00',
        mrp: '260.00',
        gstRate: '18.00',
        hsnCode: '3917',
        currentStock: 120,
        minimumStock: 25,
        description: 'Standard PVC pipe for household plumbing applications.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'PVC Elbow 1 inch',
        sku: 'PVC-ELBOW-1',
        barcode: '890123456002',
        categoryId: categories[0].id,
        brandId: brands[4].id,
        supplierId: suppliers[0].id,
        unit: 'piece',
        purchasePrice: '90.00',
        sellingPrice: '120.00',
        mrp: '135.00',
        gstRate: '18.00',
        hsnCode: '3917',
        currentStock: 85,
        minimumStock: 18,
        description: '90-degree elbow connector for water and drainage pipes.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Wall Plug 2 inch',
        sku: 'WALL-PLUG-2',
        barcode: '890123456003',
        categoryId: categories[4].id,
        brandId: brands[0].id,
        supplierId: suppliers[1].id,
        unit: 'packet',
        purchasePrice: '40.00',
        sellingPrice: '65.00',
        mrp: '72.00',
        gstRate: '18.00',
        hsnCode: '7318',
        currentStock: 220,
        minimumStock: 40,
        description: 'Heavy-duty wall plugs for masonry and concrete fastening.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Steel Screw 2 inch',
        sku: 'STEEL-SCREW-2',
        barcode: '890123456004',
        categoryId: categories[4].id,
        brandId: brands[0].id,
        supplierId: suppliers[1].id,
        unit: 'box',
        purchasePrice: '120.00',
        sellingPrice: '175.00',
        mrp: '190.00',
        gstRate: '18.00',
        hsnCode: '7318',
        currentStock: 180,
        minimumStock: 30,
        description: 'High-tensile steel screws for structural and general use.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Hammer',
        sku: 'HAMMER-1',
        barcode: '890123456005',
        categoryId: categories[2].id,
        brandId: brands[0].id,
        supplierId: suppliers[2].id,
        unit: 'piece',
        purchasePrice: '420.00',
        sellingPrice: '560.00',
        mrp: '620.00',
        gstRate: '18.00',
        hsnCode: '8205',
        currentStock: 35,
        minimumStock: 8,
        description: 'Standard claw hammer for repairs and carpentry.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Screwdriver',
        sku: 'SCREWDRIVER-1',
        barcode: '890123456006',
        categoryId: categories[2].id,
        brandId: brands[0].id,
        supplierId: suppliers[2].id,
        unit: 'piece',
        purchasePrice: '180.00',
        sellingPrice: '260.00',
        mrp: '300.00',
        gstRate: '18.00',
        hsnCode: '8205',
        currentStock: 70,
        minimumStock: 15,
        description: 'Ergonomic screwdriver for everyday maintenance tasks.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Electrical Tape',
        sku: 'ELECTRICAL-TAPE-1',
        barcode: '890123456007',
        categoryId: categories[1].id,
        brandId: brands[3].id,
        supplierId: suppliers[1].id,
        unit: 'roll',
        purchasePrice: '55.00',
        sellingPrice: '85.00',
        mrp: '100.00',
        gstRate: '18.00',
        hsnCode: '3212',
        currentStock: 160,
        minimumStock: 25,
        description: 'Insulating electrical tape for safe wire binding and repair.',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Paint Brush',
        sku: 'PAINT-BRUSH-1',
        barcode: '890123456008',
        categoryId: categories[3].id,
        brandId: brands[1].id,
        supplierId: suppliers[0].id,
        unit: 'piece',
        purchasePrice: '95.00',
        sellingPrice: '160.00',
        mrp: '175.00',
        gstRate: '18.00',
        hsnCode: '9603',
        currentStock: 80,
        minimumStock: 12,
        description: 'Durable paint brush for interior and exterior wall finishing.',
      },
    }),
  ]);

  await prisma.setting.createMany({
    data: [
      { key: 'shop_name', value: 'Nirman Hardware Centre' },
      { key: 'shop_address', value: 'MG Road, Bengaluru' },
      { key: 'shop_phone', value: '+91 9876543210' },
      { key: 'shop_gstin', value: '29ABCDE1234F1Z5' },
      { key: 'invoice_prefix', value: 'HSH' },
      { key: 'tax_mode', value: 'GST' },
      { key: 'currency', value: 'INR' },
      { key: 'allow_negative_stock', value: 'false' },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: adminUser.id,
      details: 'Initial admin user created for shop setup.',
    },
  });

  await prisma.customer.createMany({
    data: [
      { name: 'Retail Customer', phone: '+91 9000000001', address: 'Bengaluru', email: 'retail@example.com' },
      { name: 'Home Services', phone: '+91 9000000002', address: 'Mysuru', email: 'home@example.com' },
    ],
  });

  console.log('Seed completed successfully.');
  console.log('Admin user created:', adminUser.email);
  console.log('Products created:', products.length);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

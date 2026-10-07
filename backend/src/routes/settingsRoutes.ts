import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const getSettingValue = async (key: string, fallback: string) => {
  const result = await prisma.setting.findUnique({ where: { key } });
  return result?.value ?? fallback;
};

const getSettingsPayload = async () => {
  const [shopName, shopAddress, shopPhone, shopEmail, shopGstin, invoiceFooter, returnPolicy, defaultPageSize, currencySymbol] = await Promise.all([
    getSettingValue('shop_name', 'Hardware Shop'),
    getSettingValue('shop_address', '123 Main Road, Market Area'),
    getSettingValue('shop_phone', 'XXXXX XXXXX'),
    getSettingValue('shop_email', 'sales@hardwareshop.local'),
    getSettingValue('shop_gstin', 'GSTIN: XXXXX'),
    getSettingValue('invoice_footer', 'Thank you for shopping with us.'),
    getSettingValue('return_policy', 'Returns accepted within 7 days with valid proof of purchase.'),
    getSettingValue('default_page_size', '20'),
    getSettingValue('currency_symbol', '₹'),
  ]);

  return {
    shopName,
    shopAddress,
    shopPhone,
    shopEmail,
    shopGstin,
    invoiceFooter,
    returnPolicy,
    defaultPageSize: Number.parseInt(defaultPageSize, 10) || 20,
    currencySymbol,
  };
};

router.get('/', requireAuth, async (_req, res) => {
  const settings = await getSettingsPayload();
  return res.status(200).json({ success: true, settings });
});

router.put('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const payloadSchema = z.object({
    shopName: z.string().trim().max(150).optional(),
    shopAddress: z.string().trim().max(300).optional(),
    shopPhone: z.string().trim().max(60).optional(),
    shopEmail: z.string().trim().max(150).optional(),
    shopGstin: z.string().trim().max(60).optional(),
    invoiceFooter: z.string().trim().max(300).optional(),
    returnPolicy: z.string().trim().max(300).optional(),
    defaultPageSize: z.coerce.number().int().min(10).max(200).optional(),
    currencySymbol: z.string().trim().max(10).optional(),
  });

  const parsed = payloadSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid settings update.',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const keyMap: Record<string, string> = {
    shopName: 'shop_name',
    shopAddress: 'shop_address',
    shopPhone: 'shop_phone',
    shopEmail: 'shop_email',
    shopGstin: 'shop_gstin',
    invoiceFooter: 'invoice_footer',
    returnPolicy: 'return_policy',
    defaultPageSize: 'default_page_size',
    currencySymbol: 'currency_symbol',
  };

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;

    await prisma.setting.upsert({
      where: { key: keyMap[key] },
      update: { value: String(value) },
      create: { key: keyMap[key], value: String(value) },
    });
  }

  const settings = await getSettingsPayload();
  return res.status(200).json({ success: true, message: 'Settings updated successfully.', settings });
});

export default router;

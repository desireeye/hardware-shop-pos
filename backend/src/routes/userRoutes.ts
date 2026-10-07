import { Router } from 'express';
import { z } from 'zod';

import { generateTemporaryPassword } from '../config/auth.js';
import { prisma } from '../config/prisma.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';
import { hashPassword } from '../utils/password.js';
import { createStaffSchema } from '../validators/user.js';

const router = Router();

const sanitizeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: { name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role.name,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

router.use(requireAuth);

router.get('/', requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({
    success: true,
    users: users.map(sanitizeUser),
  });
});

router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const parseResult = createStaffSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message ?? 'Invalid staff data',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { name, email, password, role } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'A user with this email already exists.',
      errorCode: 'EMAIL_ALREADY_EXISTS',
    });
  }

  const staffRole = await prisma.role.findUnique({
    where: { name: 'STAFF' },
  });

  if (!staffRole) {
    return res.status(500).json({
      success: false,
      message: 'Staff role not configured.',
      errorCode: 'ROLE_NOT_FOUND',
    });
  }

  const staff = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      roleId: staffRole.id,
      isActive: true,
      mustChangePassword: true,
    },
    include: { role: true },
  });

  await createAuditLog({
    userId: req.user?.id,
    action: 'STAFF_CREATED',
    entityType: 'User',
    entityId: staff.id,
    details: `Staff account created for ${staff.name}.`,
  });

  return res.status(201).json({
    success: true,
    message: 'Staff account created successfully.',
    user: sanitizeUser(staff),
  });
});

router.patch('/:id/activate', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const userId = z.string().min(1).parse(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
      errorCode: 'USER_NOT_FOUND',
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    include: { role: true },
  });

  await createAuditLog({
    userId: req.user?.id,
    action: 'STAFF_REACTIVATED',
    entityType: 'User',
    entityId: updatedUser.id,
    details: `${updatedUser.name} account reactivated.`,
  });

  return res.status(200).json({
    success: true,
    message: 'Staff account activated successfully.',
    user: sanitizeUser(updatedUser),
  });
});

router.patch('/:id/deactivate', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const userId = z.string().min(1).parse(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
      errorCode: 'USER_NOT_FOUND',
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    include: { role: true },
  });

  await createAuditLog({
    userId: req.user?.id,
    action: 'STAFF_DEACTIVATED',
    entityType: 'User',
    entityId: updatedUser.id,
    details: `${updatedUser.name} account deactivated.`,
  });

  return res.status(200).json({
    success: true,
    message: 'Staff account deactivated successfully.',
    user: sanitizeUser(updatedUser),
  });
});

router.post('/:id/reset-password', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const userId = z.string().min(1).parse(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
      errorCode: 'USER_NOT_FOUND',
    });
  }

  const temporaryPassword = generateTemporaryPassword();

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });

  await createAuditLog({
    userId: req.user?.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user.id,
    details: `Password reset for ${user.name}. Previous password invalidated.`,
  });

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully. Share the temporary password securely with the staff member.',
    temporaryPassword,
  });
});

export default router;

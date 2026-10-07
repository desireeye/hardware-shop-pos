import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { clearAuthCookie, setAuthCookie, signToken } from '../config/auth.js';
import { prisma } from '../config/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditService.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { changePasswordSchema, loginSchema } from '../validators/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  headers: true,
  skipSuccessfulRequests: true,
  message: {
    status: 429,
    message: 'Too many login attempts. Please try again later.',
    errorCode: 'RATE_LIMITED',
  },
});

const serializeUser = (user: { id: string; name: string; email: string; role: { name: string }; isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role.name,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt,
});

router.post('/login', loginLimiter, async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message ?? 'Invalid login details',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { email, password } = parseResult.data;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await createAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        details: `Login failed for email: ${cleanEmail}`,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        details: `Inactive account attempted login: ${user.email}`,
      });

      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Please contact the shop owner.',
        errorCode: 'ACCOUNT_INACTIVE',
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role.name,
    });

    setAuthCookie(res, token);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      details: `${user.name} logged in successfully.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: serializeUser(user),
      requiresPasswordChange: user.mustChangePassword,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to authenticate at the moment.',
      errorCode: 'AUTHENTICATION_ERROR',
    });
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (userId) {
    await createAuditLog({
      userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
      details: 'User logged out successfully.',
    });
  }

  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      mustChangePassword: req.user.mustChangePassword,
    },
  });
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  const parseResult = changePasswordSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message ?? 'Invalid password change request',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const { currentPassword, newPassword } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errorCode: 'USER_NOT_FOUND',
    });
  }

  const isCurrentPasswordCorrect = await verifyPassword(currentPassword, user.passwordHash);

  if (!isCurrentPasswordCorrect) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect.',
      errorCode: 'INVALID_CURRENT_PASSWORD',
    });
  }

  if (!z.string().min(8).safeParse(newPassword).success) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.',
      errorCode: 'WEAK_PASSWORD',
    });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user.id,
    details: 'Password changed by user.',
  });

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully.',
  });
});

export default router;

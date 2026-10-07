import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { JWT_COOKIE_NAME, verifyToken } from '../config/auth.js';
import { prisma } from '../config/prisma.js';
import { AppError } from './errorHandler.js';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthRequest = Request & {
  user?: AuthenticatedUser;
};

const tokenSchema = z.string().min(1);

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tokenFromCookie = req.cookies?.[JWT_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const token = tokenFromCookie || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

    if (!token || !tokenSchema.safeParse(token).success) {
      throw new AppError('Authentication required', 'UNAUTHORIZED', 401);
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user) {
      throw new AppError('Authentication required', 'UNAUTHORIZED', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account is inactive. Please contact the shop owner.', 'ACCOUNT_INACTIVE', 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorCode: error.errorCode,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errorCode: 'UNAUTHORIZED',
    });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !allowedRoles.map((entry) => entry.toUpperCase()).includes(role.toUpperCase())) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        errorCode: 'FORBIDDEN',
      });
    }

    next();
  };
};

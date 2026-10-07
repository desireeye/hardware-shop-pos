import type { AuditAction } from '@prisma/client';

import { prisma } from '../config/prisma.js';

export type AuditLogInput = {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
};

export const createAuditLog = async ({ userId, action, entityType, entityId, details }: AuditLogInput) => {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details,
    },
  });
};

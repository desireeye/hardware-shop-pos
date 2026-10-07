import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const emailSchema = z.string().trim().email('Please provide a valid email address');

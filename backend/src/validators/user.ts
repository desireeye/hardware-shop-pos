import { z } from 'zod';

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long'),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(1, 'Please confirm the password'),
    role: z.enum(['STAFF']).default('STAFF'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const userStatusSchema = z.object({
  active: z.boolean().optional(),
});

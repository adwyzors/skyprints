import { z } from 'zod';

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER']).optional(),
    locationId: z.string().uuid('Invalid locationId').nullable().optional(),
    isActive: z.boolean().optional(),
    username: z.string().min(3, 'Username must be at least 3 characters').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

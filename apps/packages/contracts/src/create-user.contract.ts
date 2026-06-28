import { z } from 'zod';
import { PasswordSchema } from './password.schema';

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER']),
  locationId: z.string().uuid('Invalid locationId').optional(),
  password: PasswordSchema,
  permissions: z.array(z.string()).optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

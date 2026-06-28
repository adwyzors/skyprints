import { z } from 'zod';

export const PasswordSchema = z
  .string()
  .min(3, 'Password must be at least 3 characters')
  .refine((s) => /[a-zA-Z]/.test(s), {
    message: 'Password must contain at least one letter',
  });

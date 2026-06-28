import { z } from 'zod';
import { PasswordSchema } from './password.schema';

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

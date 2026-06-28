import { z } from 'zod';

export const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export type UpdatePermissionsDto = z.infer<typeof UpdatePermissionsSchema>;

import { z } from 'zod';

/* =========================
 * Create Location
 * ========================= */

export const CreateLocationSchema = z.object({
    code: z.string().min(1).trim(),
    name: z.string().min(1).trim(),
    description: z.string().optional().nullable(),
    type: z.string().default('WORKSTATION'),
    isActive: z.boolean().default(true),
});

export type CreateLocationDto = z.infer<typeof CreateLocationSchema>;

/* =========================
 * Update Location
 * ========================= */

export const UpdateLocationSchema = CreateLocationSchema.partial();

export type UpdateLocationDto = z.infer<typeof UpdateLocationSchema>;

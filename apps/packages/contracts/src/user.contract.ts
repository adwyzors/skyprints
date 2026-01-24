import { z } from 'zod';

/**
 * Create / Sync user
 */
export const SyncUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
});

export type SyncUserDto = z.infer<typeof SyncUserSchema>;

/**
 * Soft delete
 */
export const SoftDeleteUserSchema = z.object({
    email: z.string().email(),
});

export type SoftDeleteUserDto = z.infer<typeof SoftDeleteUserSchema>;

/**
 * Assign or unassign a location
 * locationCode = null → unassign
 */
export const AssignLocationSchema = z.object({
    email: z.string().email(),
    locationCode: z.string().min(1).nullable(),
});

export type AssignLocationDto = z.infer<typeof AssignLocationSchema>;

import { z } from 'zod';

/**
 * User preferences — strict schema to prevent arbitrary key injection (B8)
 */
export const UpdatePreferencesSchema = z
  .object({
    showRevenue: z.boolean().optional(),
    showOrders: z.boolean().optional(),
    showUnits: z.boolean().optional(),
    showHubs: z.boolean().optional(),
    showPulse: z.boolean().optional(),
    showChart: z.boolean().optional(),
    showPerformance: z.boolean().optional(),
    showProcesses: z.boolean().optional(),
    showCustomers: z.boolean().optional(),
    showWorkload: z.boolean().optional(),
    showMatrix: z.boolean().optional(),
    fontSize: z.enum(['sm', 'base', 'lg']).optional(),
  })
  .strict();

export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;

/**
 * Create / Sync user
 */
export const SyncUserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1),
    role: z.string().min(1),
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

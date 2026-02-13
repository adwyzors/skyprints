import { z } from 'zod';

/* =========================
 * Query Locations
 * ========================= */

export const QueryLocationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    search: z.string().trim().min(1).optional(),
    isActive: z.coerce.boolean().optional(),
});

export type QueryLocationDto = z.infer<typeof QueryLocationSchema>;

/* =========================
 * Location Summary (Response)
 * ========================= */

export const LocationSummarySchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    type: z.string(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
});

export type LocationSummaryDto = z.infer<typeof LocationSummarySchema>;

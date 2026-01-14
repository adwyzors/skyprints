import { z } from 'zod';

export const CustomerSummarySchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type CustomerSummaryDto =
    z.infer<typeof CustomerSummarySchema>;

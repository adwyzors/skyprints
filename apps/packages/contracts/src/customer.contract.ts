import { z } from 'zod';

/* =========================
 * Create Customer
 * ========================= */

export const CreateCustomerSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
});

export type CreateCustomerDto =
    z.infer<typeof CreateCustomerSchema>;

/* =========================
 * Query Customers
 * ========================= */

export const QueryCustomerSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
});

export type QueryCustomerDto =
    z.infer<typeof QueryCustomerSchema>;

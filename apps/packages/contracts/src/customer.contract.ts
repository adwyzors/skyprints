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

    gstno: z.string().optional().nullable(),
    tdsno: z.coerce.number().int().optional().nullable(),
    tds: z.boolean().optional(),
    tax: z.boolean().optional(),

    isActive: z.boolean().optional(),
});

export type CreateCustomerDto =
    z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type UpdateCustomerDto =
    z.infer<typeof UpdateCustomerSchema>;

/* =========================
 * Query Customers
 * ========================= */

export const QueryCustomerSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(1000).optional(),

    search: z.string().trim().min(1).optional(),
    isActive: z.coerce.boolean().optional(),
});

export type QueryCustomerDto =
    z.infer<typeof QueryCustomerSchema>;


import { z } from 'zod';

export const CustomerSummarySchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),

    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),

    gstno: z.string().nullable(),   
    tds: z.boolean(),               
    tax: z.boolean(),               

    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});


export type CustomerSummaryDto =
    z.infer<typeof CustomerSummarySchema>;

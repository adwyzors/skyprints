import { z } from 'zod';

export const CreateOrderProcessSchema = z.object({
    processId: z.string().uuid(),
    count: z.number().int().positive(),
});

export const CreateOrderSchema = z.object({
    customerId: z.string().uuid(),
    quantity: z.number().int().positive(),
    jobCode: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    processes: z.array(CreateOrderProcessSchema).min(1),
});

export type CreateOrderDto =
    z.infer<typeof CreateOrderSchema>;


export const UpdateOrderSchema = z.object({
    customerId: z.string().uuid().optional(),
    quantity: z.number().int().positive().optional(),
    jobCode: z.string().nullable().optional(),
    images: z.array(z.string().url()).optional(),
});

export type UpdateOrderDto =
    z.infer<typeof UpdateOrderSchema>;

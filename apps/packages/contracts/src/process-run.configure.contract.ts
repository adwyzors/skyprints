import { z } from 'zod';

export const ConfigureProcessRunSchema = z.object({
    fields: z.record(z.string(), z.any()),

    locationId: z.string().uuid().optional(),
    executorId: z.string().uuid().optional(),
    reviewerId: z.string().uuid().optional(),
    images: z.array(z.string()).optional(),
});

export type ConfigureProcessRunDto =
    z.infer<typeof ConfigureProcessRunSchema>;



export const TransitionProcessRunSchema = z.object({
    statusCode: z
        .string()
        .trim()
        .min(1, 'statusCode is required'),
});

export type TransitionProcessRunDto =
    z.infer<typeof TransitionProcessRunSchema>;

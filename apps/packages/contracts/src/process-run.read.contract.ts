import { z } from 'zod';

export const ProcessRunListItemSchema = z.object({
    id: z.string().uuid(),
    statusCode: z.string(),
    runTemplate: z.object({
        name: z.string(),
    }),
    orderProcess: z.object({
        order: z.object({
            id: z.string().uuid(),
            code: z.string(),
            customer: z.object({
                name: z.string(),
            }),
        }),
    }),
});

export type ProcessRunListItemDto = z.infer<typeof ProcessRunListItemSchema>;

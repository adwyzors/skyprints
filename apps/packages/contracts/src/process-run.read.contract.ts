import { z } from 'zod';

export const ProcessRunPrioritySchema = z.enum([
    'HIGH',
    'MEDIUM',
    'LOW',
]);

export const ProcessRunListItemSchema = z.object({
    id: z.string().uuid(),

    statusCode: z.enum(['CONFIGURE', 'IN_PROGRESS', 'COMPLETE']),
    lifeCycleStatusCode: z.string(),

    runNumber: z.number(),
    displayName: z.string(),

    runTemplate: z.object({
        name: z.string(),
    }),

    executor: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
        })
        .nullable(),

    reviewer: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
        })
        .nullable(),

    // ✅ NEW: priority exposed to UI
    priority: ProcessRunPrioritySchema,

    orderProcess: z.object({
        totalRuns: z.number(),
        configCompletedRuns: z.number(),
        lifecycleCompletedRuns: z.number(),
        remainingRuns: z.number(),

        order: z.object({
            id: z.string().uuid(),
            code: z.string(),
            customer: z.object({
                name: z.string(),
            }),
        }),
    }),

    createdAt: z.string().datetime(),
});

export type ProcessRunListItemDto =
    z.infer<typeof ProcessRunListItemSchema>;

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

    runTemplate: z.object({
        name: z.string(),
    }),

    executor: z
        .object({
            name: z.string(),
        })
        .nullable(),

    reviewer: z
        .object({
            name: z.string(),
        })
        .nullable(),

    // ✅ NEW: priority exposed to UI
    priority: ProcessRunPrioritySchema,
    fields: z.record(z.string(), z.any()).optional(),

    orderProcess: z.object({
        totalRuns: z.number().optional(),
        lifecycleCompletedRuns: z.number().optional(),
        remainingRuns: z.number().optional(),

        order: z.object({
            id: z.string().uuid(),
            code: z.string(),
            customer: z.object({
                name: z.string(),
            }),
        }),
    }),

    createdAt: z.string().datetime().optional(),
});

export type ProcessRunListItemDto =
    z.infer<typeof ProcessRunListItemSchema>;

export const ProcessRunDetailSchema = ProcessRunListItemSchema.extend({
    // Override optional fields to be required for detail view
    fields: z.record(z.string(), z.any()),
    createdAt: z.string().datetime(),

    displayName: z.string(),
    configStatus: z.string(),

    // Lifecycle history for timeline
    lifecycle: z.array(z.object({
        code: z.string(),
        completed: z.boolean(),
    })),

    // Field definitions for UI rendering (optional, but helpful)
    templateFields: z.array(z.object({
        key: z.string(),
        type: z.string(),
        required: z.boolean(),
    })),
});

export type ProcessRunDetailDto = z.infer<typeof ProcessRunDetailSchema>;

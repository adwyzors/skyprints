import { z } from 'zod';

/* ---------------- PROCESS RUN ---------------- */

export const TemplateFieldSchema = z.object({
    key: z.string(),
    type: z.string(),
    required: z.boolean(),
});

export const OrderProcessRunSchema = z.object({
    id: z.string().uuid(),
    runNumber: z.number(),
    displayName: z.string(),

    configStatus: z.string(),
    lifecycleStatus: z.string(),

    values: z.record(z.string(), z.any()),

    fields: z.array(TemplateFieldSchema),

    lifecycle: z
        .array(
            z.object({
                code: z.string(),
                completed: z.boolean(),
            }),
        )
        .optional(),
});

export type OrderProcessRunDto =
    z.infer<typeof OrderProcessRunSchema>;

/* ---------------- ORDER PROCESS ---------------- */

export const OrderProcessSchema = z.object({
    id: z.string().uuid(),
    processId: z.string().uuid(),
    name: z.string(),
    status: z.string(),

    totalRuns: z.number().int(),
    completedRuns: z.number().int().optional(),

    runs: z.array(OrderProcessRunSchema),
});

/* ---------------- ORDER ---------------- */

export const OrderSummarySchema = z.object({
    id: z.string().uuid(),
    quantity: z.number(),
    status: z.string(),
    createdAt: z.string(),
    code: z.string(),
    jobCode: z.string().optional().nullable(),
    images: z.array(z.string().url()).default([]),

    totalProcesses: z.number().int(),
    completedProcesses: z.number().int().optional(),

    customer: z.object({
        id: z.string().uuid(),
        code: z.string(),
        name: z.string(),
    }),

    processes: z.array(OrderProcessSchema),
});

export type OrderSummaryDto =
    z.infer<typeof OrderSummarySchema>;

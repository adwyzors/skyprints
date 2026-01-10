import { z } from "zod";

export const ProcessRunSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    runNumber: z.number(),

    status: z.string(),
    locationId: z.string().nullable(),

    // dynamic backend fields
    fields: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.null()])
    ),

    // only present for configurable runs
    runTemplate: z
        .object({
            id: z.string(),
            name: z.string(),
            fields: z.array(
                z.object({
                    key: z.string(),
                    type: z.string(),
                    required: z.boolean(),
                })
            ),
        })
        .optional(),
});

export type ProcessRun = z.infer<typeof ProcessRunSchema>;

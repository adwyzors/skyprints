import { z } from "zod"

export const ProcessRunDtoSchema = z.object({
    id: z.string(),
    orderProcessId: z.string(),
    displayName: z.string(),
    runTemplateId: z.string(),
    runNumber: z.number(),
    statusCode: z.string(),
    statusVersion: z.number(),
    locationId: z.string().nullable(),
    assignedToId: z.string().nullable(),
    fields: z.record(z.string(), z.string().nullable()),
    createdAt: z.string(),
    updatedAt: z.string(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
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
})

export type ProcessRunDto = z.infer<typeof ProcessRunDtoSchema>

import { z } from "zod"

export const RunDtoSchema = z.object({
    id: z.string(),
    orderProcessId: z.string(),
    displayName: z.string(),
    runTemplateId: z.string(),
    runNumber: z.number(),
    statusCode: z.string(),
    statusVersion: z.number(),
    locationId: z.string().nullable(),
    fields: z.record(z.string(), z.string().nullable()),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export type RunDto = z.infer<typeof RunDtoSchema>

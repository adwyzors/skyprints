import { z } from "zod"

/**
 * Field schema inside runTemplate.fields
 */
export const RunTemplateFieldSchema = z.object({
    key: z.string(),
    type: z.string(),
    required: z.boolean(),
})

/**
 * runTemplate schema
 */
export const RunTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    fields: z.array(RunTemplateFieldSchema),
    createdAt: z.string(),
})

/**
 * RunDef DTO schema
 */
export const RunDefDtoSchema = z.object({
    id: z.string(),
    processId: z.string(),
    runTemplateId: z.string(),
    displayName: z.string(),
    sortOrder: z.number(),
    createdAt: z.string(),
    runTemplate: RunTemplateSchema,
})

export type RunDefDto = z.infer<typeof RunDefDtoSchema>

import { z } from "zod"


/**
 * RunTemplate Field (Model)
 */
export const RunTemplateFieldModelSchema = z.object({
    key: z.string(),
    type: z.string(),
    required: z.boolean(),
})

/**
 * RunTemplate (Model)
 */
export const RunTemplateModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    fields: z.array(RunTemplateFieldModelSchema),
    createdAt: z.string(),
})

export type RunTemplate = z.infer<typeof RunTemplateModelSchema>

/**
 * RunDef (Model)
 */
export const RunDefModelSchema = z.object({
    id: z.string(),
    processId: z.string(),
    runTemplateId: z.string(),
    displayName: z.string(),
    sortOrder: z.number(),
    createdAt: z.string(),
    runTemplate: RunTemplateModelSchema,
})

export type RunDef = z.infer<typeof RunDefModelSchema>



//export const RunDefModelSchema = z.object({
//    id: z.string(),
//    displayName: z.string(),
//    runNumber: z.number(),
//    status: z.string(),
//    locationId: z.string().nullable(),
//    // only present for configurable runs
//    runTemplate: z
//        .object({
//            id: z.string(),
//            name: z.string(),
//            fields: z.array(
//                z.object({
//                    key: z.string(),
//                    type: z.string(),
//                    required: z.boolean(),
//                })
//            ),
//        })
//        .optional(),
//    // dynamic fields from backend
//    fields: z.record(z.string(), z.string().nullable()),
//})

//export type Run = z.infer<typeof RunDefModelSchema>

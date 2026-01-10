import { z } from "zod"

export const RunModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  runNumber: z.number(),
  status: z.string(),
  locationId: z.string().nullable(),
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
  // dynamic fields from backend
  fields: z.record(z.string(), z.string().nullable()),
})

export type Run = z.infer<typeof RunModelSchema>

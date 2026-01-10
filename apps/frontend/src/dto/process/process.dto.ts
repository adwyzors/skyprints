import { z } from "zod"
import { RunDtoSchema } from "../run/run.dto"

export const MiniProcessDtoSchema = z.object({
    name: z.string()
});
export const ProcessDtoSchema = z.object({
    id: z.string(),
    orderId: z.string(),
    processId: z.string(),
    statusCode: z.string(),
    minRuns: z.number(),
    maxRuns: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    process: MiniProcessDtoSchema.optional(),
    runs: z.array(RunDtoSchema),
})



export type ProcessDto = z.infer<typeof ProcessDtoSchema>

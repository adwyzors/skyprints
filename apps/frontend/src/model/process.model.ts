import { z } from "zod"
import { RunModelSchema } from "./run.model"
import { ProcessRunSchema } from "./process.run.model"


export const ProcessModelSchema = z.object({
    id: z.string(),
    processId: z.string(),
    processName: z.string().nullable(),
    status: z.string(),
    minRuns: z.number(),
    maxRuns: z.number(),
    runs: z.array(ProcessRunSchema),
})


export type Process = z.infer<typeof ProcessModelSchema>

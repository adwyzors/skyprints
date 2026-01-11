import { z } from "zod"
import { RunDefDtoSchema } from "@/dto/run/run.dto"
import { RunDefModelSchema } from "./run.model"
import { ProcessRunModelSchema } from "./process.run.model"


export const ProcessModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    isEnabled: z.boolean(),
    runDefs: z.array(RunDefModelSchema),
})


export type Process = z.infer<typeof ProcessModelSchema>


export const OrderProcessModelSchema = z.object({
    id: z.string(),
    orderId: z.string(),
    processId: z.string(),
    statusCode: z.string(),
    minRuns: z.number(),
    maxRuns: z.number(),
    createdAt: z.string(),
    processName: z.string(),
    runs: z.array(ProcessRunModelSchema),
})


export type OrderProcess = z.infer<typeof OrderProcessModelSchema>
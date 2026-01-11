// src/dto/process/process.dto.ts
import { z } from "zod";
import { RunDefDtoSchema } from "../run/run.dto";
import { ProcessRunDtoSchema } from "../run/process.run.dto";

/* -------------------- PROCESS (ADMIN CONFIG) -------------------- */

export const ProcessDtoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    isEnabled: z.boolean(),
    runDefs: z.array(RunDefDtoSchema).default([]),
});

export const ProcessDtoArraySchema = z.array(ProcessDtoSchema);
export type ProcessDto = z.infer<typeof ProcessDtoSchema>;

/* -------------------- ORDER PROCESS (RUNTIME) -------------------- */

export const WorkflowStatusDtoSchema = z.object({
    id: z.string(),
    code: z.string(),
});

export const WorkflowTypeDtoSchema = z.object({
    id: z.string(),
    code: z.string(),
    statuses: z.array(WorkflowStatusDtoSchema),
});

export const MiniProcessDtoSchema = z.object({
    id: z.string(),
    name: z.string(),
});

export const OrderProcessDtoSchema = z.object({
    id: z.string(),
    orderId: z.string(),
    processId: z.string(),
    statusCode: z.string(),
    minRuns: z.number(),
    maxRuns: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),

    workflowType: WorkflowTypeDtoSchema,

    process: MiniProcessDtoSchema,
    runs: z.array(ProcessRunDtoSchema),
});

export type OrderProcessDto = z.infer<typeof OrderProcessDtoSchema>;

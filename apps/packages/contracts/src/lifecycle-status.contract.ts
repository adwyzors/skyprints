import z from "zod";

export const LifeCycleStatusSchema = z.object({
    id: z.string(),
    code: z.string(),
})


export type LifeCycleStatusDto =
    z.infer<typeof LifeCycleStatusSchema>;
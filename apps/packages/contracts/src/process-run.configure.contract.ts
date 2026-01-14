import { z } from 'zod';

export const ConfigureProcessRunSchema = z.object({
    fields: z.record(z.string(), z.any()),
});

export type ConfigureProcessRunDto =
    z.infer<typeof ConfigureProcessRunSchema>;



export const TransitionProcessRunSchema = z.object({
});

export type TransitionProcessRunDto =
    z.infer<typeof TransitionProcessRunSchema>;


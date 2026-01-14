// packages/contracts/src/run-template.contract.ts
import { z } from 'zod';

export const RunTemplateFieldSchema = z.object({
    key: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'date']),
    required: z.boolean().optional().default(false),
});

export type RunTemplateField =
    z.infer<typeof RunTemplateFieldSchema>;

export const CreateRunTemplateSchema = z.object({
    name: z.string().min(1),
    fields: z.array(RunTemplateFieldSchema).min(1),
    lifecycle: z.array(z.string().min(1)).min(1),
});
export type CreateRunTemplateDto = z.infer<typeof CreateRunTemplateSchema>;

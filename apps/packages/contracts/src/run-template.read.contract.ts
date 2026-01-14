import { z } from 'zod';

/* =========================
 * Summary
 * ========================= */

export const RunTemplateSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
});

export type RunTemplateSummaryDto = z.infer<
    typeof RunTemplateSummarySchema
>;

/* =========================
 * Detail
 * ========================= */

export const RunTemplateDetailSchema = z.object({
    id: z.string(),
    name: z.string(),
    fields: z.array(z.any()),
    lifecycle: z.array(z.string()),
});

export type RunTemplateDetailDto = z.infer<
    typeof RunTemplateDetailSchema
>;

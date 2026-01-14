import { z } from 'zod';

/* =====================================================
 * SUMMARY DTO (GET /process)
 * ===================================================== */

export const ProcessSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  runCount: z.number().int(),
});

export type ProcessSummaryDto =
  z.infer<typeof ProcessSummarySchema>;


/* =====================================================
 * DETAIL DTO (GET /process/:id)
 * ===================================================== */

export const ProcessRunDefinitionSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  sortOrder: z.number().int(),
  runTemplate: z.object({
    id: z.string().uuid(),
    name: z.string(),
    fields: z.array(z.any()), // tighten later if needed
  }),
});

export const ProcessDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),

  runs: z.array(ProcessRunDefinitionSchema),
});

export type ProcessDetailDto =
  z.infer<typeof ProcessDetailSchema>;

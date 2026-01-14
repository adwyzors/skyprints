import { z } from 'zod';

/* =====================================================
 * Create Process (POST /process)
 * ===================================================== */

export const CreateProcessRunSchema = z.object({
  runTemplateId: z.string().uuid(),
  displayName: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const CreateProcessSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  runs: z.array(CreateProcessRunSchema).min(1),

  isEnabled: z.boolean().optional().default(false),
});

export type CreateProcessDto =
  z.infer<typeof CreateProcessSchema>;

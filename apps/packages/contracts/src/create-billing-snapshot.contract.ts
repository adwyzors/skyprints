import { z } from "zod";

/**
 * Dynamic inputs for a single ProcessRun
 * Keys must be valid formula variables
 * Values must be finite numbers
 */
export const RunDynamicInputsSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]*$/, {
    message: "Invalid formula variable name",
  }),
  z.number().finite()
);

/**
 * Billing snapshot request
 * Dynamic inputs are PER RUN
 */
export const CreateBillingSnapshotSchema = z.object({
  runs: z
    .record(
      z.string().uuid(),        // processRunId
      RunDynamicInputsSchema
    )
    .optional(),

  reason: z.string().optional(),
});

export type CreateBillingSnapshotDto =
  z.infer<typeof CreateBillingSnapshotSchema>;

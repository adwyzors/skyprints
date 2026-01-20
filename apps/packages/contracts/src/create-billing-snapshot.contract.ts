import { z } from "zod";
import { RunDynamicInputsSchema } from "./billing-snapshot.contract";



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

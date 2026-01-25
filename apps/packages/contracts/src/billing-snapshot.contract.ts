import { z } from "zod";

export const RunDynamicInputsSchema = z.record(
    z.string(),
    z.number().finite()
);

export const CreateBillingDraftSchema = z.object({
    runs: z.record(z.string().uuid(), RunDynamicInputsSchema),
    reason: z.string().optional()
});

export type CreateBillingDraftDto =
    z.infer<typeof CreateBillingDraftSchema>;



export const BillingSnapshotResponseDto = z.object({
    billingContextId: z.string().uuid(),
    type: z.enum(["ORDER", "GROUP"]),
    version: z.number(),
    intent: z.enum(["DRAFT", "FINAL"]),
    currency: z.string(),
    result: z.string(), // Decimal serialized
    inputs: z.record(z.string(), z.any()),
    isLatest: z.literal(true),
    createdAt: z.string()
});

export type BillingSnapshotResponseDto =
    z.infer<typeof BillingSnapshotResponseDto>;



export const GetLatestBillingSnapshotDto = z
    .object({
        orderId: z.string().uuid().optional(),
        billingContextId: z.string().uuid().optional()
    })
    .refine(
        data => data.orderId || data.billingContextId,
        {
            message: "Either orderId or billingContextId must be provided"
        }
    );

export type GetLatestBillingSnapshotDto =
    z.infer<typeof GetLatestBillingSnapshotDto>;


    export const BillingContextResponseSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(["ORDER", "GROUP"]),
    name: z.string().optional(),
    description: z.string().optional(),
    metadata: z.any().optional(),

    orderIds: z.array(z.string().uuid()),

    latestSnapshot: BillingSnapshotResponseDto.nullable()
});

export type BillingContextResponseDto =
    z.infer<typeof BillingContextResponseSchema>;





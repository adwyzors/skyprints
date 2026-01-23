import { z } from "zod";

export const CreateBillingContextSchema = z.object({
    type: z.enum(["ORDER", "GROUP"]),
    name: z.string(),
    description: z.string().optional(),
    metadata: z.any().optional(),

    orderIds: z.array(z.string().uuid()).optional()
});

export type CreateBillingContextDto =
    z.infer<typeof CreateBillingContextSchema>;



export const AddOrdersToBillingContextSchema = z.object({
    orderIds: z
        .array(z.string().uuid())
        .min(1, "At least one orderId is required")
});

export type AddOrdersToBillingContextDto =
    z.infer<typeof AddOrdersToBillingContextSchema>;


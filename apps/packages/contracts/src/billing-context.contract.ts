import { z } from "zod";

export const CreateBillingContextSchema = z.object({
    type: z.enum(["ORDER", "GROUP"]),

    // name only allowed for ORDER
    name: z.string().optional(),

    description: z.string().optional(),
    metadata: z.any().optional(),

    orderIds: z.array(z.string().uuid()).optional()
}).superRefine((data, ctx) => {
    if (data.type === "ORDER" && !data.name) {
        ctx.addIssue({
            path: ["name"],
            message: "name is required for ORDER billing context",
            code: z.ZodIssueCode.custom
        });
    }

    if (data.type === "GROUP" && data.name) {
        ctx.addIssue({
            path: ["name"],
            message: "name must not be provided for GROUP billing context",
            code: z.ZodIssueCode.custom
        });
    }
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


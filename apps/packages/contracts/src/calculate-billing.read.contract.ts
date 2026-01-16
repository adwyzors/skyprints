import { z } from "zod";

const StrictNumber = z.coerce
    .number()
    .finite({ message: "Number must be finite" })
    .refine((v) => !Number.isNaN(v), {
        message: "Value must not be NaN"
    });

export const CalculateBillingResponseSchema = z.object({
    amount: StrictNumber
});

export type CalculateBillingResponseDto = z.infer<typeof CalculateBillingResponseSchema>;

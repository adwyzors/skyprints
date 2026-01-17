import { z } from "zod";

const StrictNumber = z.coerce
    .number()
    .finite({ message: "Number must be finite" })
    .refine((v) => !Number.isNaN(v), {
        message: "Value must not be NaN"
    });

export const CalculateBillingSchema = z.object({
    dynamicInputs: z.record(
        z.string().min(1),
        StrictNumber
    )
});

export type CalculateBillingDto = z.infer<typeof CalculateBillingSchema>;

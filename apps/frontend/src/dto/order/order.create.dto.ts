import { z } from "zod"

export const OrderCreateDtoSchema = z.object({
    id: z.string(),
    orderCode: z.string(),
    customerId: z.string(),
    quantity: z.number(),
    statusCode: z.string(),
    totalAmount: z.number().nullable(),
    userId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export type OrderCreateDto = z.infer<typeof OrderCreateDtoSchema>

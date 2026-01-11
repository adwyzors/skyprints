import { z } from "zod"
import { CustomerModelSchema } from "./customer.model"
import { OrderProcessModelSchema, ProcessModelSchema } from "./process.model"

export const OrderModelSchema = z.object({
    id: z.string(),
    code: z.string(),
    quantity: z.number(),
    status: z.string(),
    totalAmount: z.number().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),

    customer: CustomerModelSchema.optional(),
    processes: z.array(OrderProcessModelSchema),
})

export type Order = z.infer<typeof OrderModelSchema>

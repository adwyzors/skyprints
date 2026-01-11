import { z } from "zod"
import { OrderProcessDtoSchema } from "../process/process.dto"

export const OrderListDtoSchema = z.object({
    id: z.string(),
    orderCode: z.string(),
    customerId: z.string(),
    quantity: z.number(),
    statusCode: z.string(),
    totalAmount: z.number().nullable(),
    userId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),

    processes: z.array(OrderProcessDtoSchema),
})

export type OrderListDto = z.infer<typeof OrderListDtoSchema>

import { z } from "zod"
import { OrderProcessDtoSchema, ProcessDtoSchema } from "../process/process.dto"
import { CustomerDtoSchema } from "../customer/customer.dto"

export const OrderDetailDtoSchema = z.object({
    id: z.string(),
    orderCode: z.string(),
    customerId: z.string(),
    quantity: z.number(),
    statusCode: z.string(),
    totalAmount: z.number().nullable(),
    userId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),

    customer: CustomerDtoSchema, 
    processes: z.array(OrderProcessDtoSchema), 
})

export type OrderDetailDto = z.infer<typeof OrderDetailDtoSchema>

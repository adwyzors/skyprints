import { z } from "zod"
import { CustomerModelSchema } from "./customer.model"
import { ProcessModelSchema } from "./process.model"

export const OrderModelSchema = z.object({
  id: z.string(),
  code: z.string(),
  quantity: z.number(),
  status: z.string(),
  totalAmount: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),

  customer: CustomerModelSchema.optional(), // ⭐ optional by design
  processes: z.array(ProcessModelSchema),
})

export type Order = z.infer<typeof OrderModelSchema>

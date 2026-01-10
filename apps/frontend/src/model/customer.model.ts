import { z } from "zod"

export const CustomerModelSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
})

export type Customer = z.infer<typeof CustomerModelSchema>

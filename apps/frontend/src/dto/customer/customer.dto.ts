import { z } from "zod"

export const CustomerDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CustomerDto = z.infer<typeof CustomerDtoSchema>

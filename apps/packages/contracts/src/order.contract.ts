import { z } from 'zod';

export const CreateOrderProcessSchema = z.object({
  processId: z.string().uuid(),
  count: z.number().int().positive(),
});

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  quantity: z.number().int().positive(),
  processes: z.array(CreateOrderProcessSchema).min(1),
});

export type CreateOrderDto =
  z.infer<typeof CreateOrderSchema>;

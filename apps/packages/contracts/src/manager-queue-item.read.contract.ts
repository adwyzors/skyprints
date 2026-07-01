import { z } from 'zod';

export const ManagerQueueItemSchema = z.object({
  id: z.string().uuid(),
  runNumber: z.number(),
  orderId: z.string().uuid(),
  orderCode: z.string(),
  customerName: z.string(),
  quantity: z.number().nullable(),
  processName: z.string(),
  lifeCycleStatusCode: z.string(),
  comments: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type ManagerQueueItemDto = z.infer<typeof ManagerQueueItemSchema>;

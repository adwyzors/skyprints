import { z } from 'zod';
import { ManagerQueueItemSchema } from './manager-queue-item.read.contract';

export const ManagerActiveJobSchema = ManagerQueueItemSchema.extend({
  claimedAt: z.string(),
  pausedAt: z.string().nullable().optional(),
  pausedDurationSeconds: z.number().optional(),
});

export type ManagerActiveJobDto = z.infer<typeof ManagerActiveJobSchema>;

import { z } from 'zod';

export const StagePermissionEntrySchema = z.object({
  processId: z.string().uuid(),
  lifecycleStageId: z.string().uuid(),
});

export const AssignStagePermissionsSchema = z.array(StagePermissionEntrySchema);

export type StagePermissionEntryDto = z.infer<typeof StagePermissionEntrySchema>;
export type AssignStagePermissionsDto = z.infer<typeof AssignStagePermissionsSchema>;

export const ManagerStagePermissionSchema = z.object({
  processId: z.string().uuid(),
  processName: z.string(),
  lifecycleStageId: z.string().uuid(),
  stageCode: z.string(),
});

export type ManagerStagePermissionDto = z.infer<typeof ManagerStagePermissionSchema>;

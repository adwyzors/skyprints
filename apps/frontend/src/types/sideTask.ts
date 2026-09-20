export type SideTaskStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'ABANDONED';

export type SideTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SideTaskStageOutcome =
  | 'COMPLETED'
  | 'REASSIGNED'
  | 'SUBMITTED_FOR_REVIEW'
  | 'RETURNED'
  | 'ABANDONED';

export interface SideTaskStageType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SideTaskStageHistory {
  id: string;
  sideTaskId: string;
  stageTypeId: string;
  assignedUserId: string;
  assignedAt: string;
  startedAt: string | null;
  lastStartedAt: string | null;
  pausedAt: string | null;
  totalPausedSeconds: number;
  totalTimeSeconds: number;
  completedAt: string | null;
  completionNote: string | null;
  outcome: SideTaskStageOutcome | null;
  reassignmentReason: string | null;
  reviewReturnReason: string | null;
  createdAt: string;
  stageType: SideTaskStageType;
  assignedUser: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SideTask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  priority: SideTaskPriority;
  status: SideTaskStatus;
  requiredBy: string | null;
  images: string[];
  customerId: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  currentAssigneeId: string | null;
  currentAssignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  currentStageTypeId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  totalTimeSeconds?: number;
  stageHistories: SideTaskStageHistory[];
}

export interface CreateSideTaskPayload {
  title: string;
  description?: string;
  customerId?: string;
  priority?: SideTaskPriority;
  requiredBy?: string;
  images?: string[];
  initialStageTypeId: string;
  initialAssigneeId: string;
}

export interface UpdateSideTaskPayload {
  title?: string;
  description?: string;
  customerId?: string;
  priority?: SideTaskPriority;
  requiredBy?: string;
  images?: string[];
}

export interface PassStagePayload {
  nextStageTypeId: string;
  nextAssigneeId: string;
  completionNote?: string;
}

export interface ReassignStagePayload {
  newAssigneeId: string;
  reason?: string;
}

export interface SubmitReviewPayload {
  completionNote: string;
}

export interface SendBackReviewPayload {
  reason: string;
  assignedUserId?: string;
}

export interface AbandonSideTaskPayload {
  reason?: string;
}

export interface CreateStageTypePayload {
  name: string;
  code: string;
  sortOrder?: number;
}

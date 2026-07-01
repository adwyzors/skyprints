import { apiRequest } from './api.service';

export interface ManagerQueueItem {
  id: string;
  runNumber: number;
  orderId: string;
  orderCode: string;
  customerName: string;
  quantity: number | null;
  processName: string;
  lifeCycleStatusCode: string;
  comments: string | null;
  artworkUrl: string | null;
  createdAt: string;
}

export interface ManagerActiveJob extends ManagerQueueItem {
  claimedAt: string;
}

export async function listQueue(): Promise<ManagerQueueItem[]> {
  return apiRequest<ManagerQueueItem[]>('/manager-queue');
}

export async function listActive(): Promise<ManagerActiveJob[]> {
  return apiRequest<ManagerActiveJob[]>('/manager-queue/active');
}

export async function claimRun(runId: string): Promise<void> {
  await apiRequest<void>(`/manager-queue/${runId}/claim`, { method: 'POST' });
}

export async function releaseRun(runId: string): Promise<void> {
  await apiRequest<void>(`/manager-queue/${runId}/release`, { method: 'POST' });
}

export async function completeRun(
  runId: string,
): Promise<{ success: true; status: string }> {
  return apiRequest<{ success: true; status: string }>(
    `/manager-queue/${runId}/complete`,
    { method: 'POST' },
  );
}

export async function forceReleaseRun(runId: string): Promise<void> {
  await apiRequest<void>(`/manager-queue/${runId}/force-release`, {
    method: 'POST',
  });
}

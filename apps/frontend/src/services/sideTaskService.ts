import { apiRequest } from './api.service';
import {
  AbandonSideTaskPayload,
  CreateSideTaskPayload,
  CreateStageTypePayload,
  PassStagePayload,
  ReassignStagePayload,
  SendBackReviewPayload,
  SideTask,
  SideTaskStageType,
  SubmitReviewPayload,
  UpdateSideTaskPayload,
} from '@/types/sideTask';

export async function listStageTypes(): Promise<SideTaskStageType[]> {
  return apiRequest<SideTaskStageType[]>('/side-tasks/stage-types');
}

export async function createStageType(
  payload: CreateStageTypePayload,
): Promise<SideTaskStageType> {
  return apiRequest<SideTaskStageType>('/side-tasks/stage-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createSideTask(
  payload: CreateSideTaskPayload,
): Promise<SideTask> {
  return apiRequest<SideTask>('/side-tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMySideTasks(): Promise<SideTask[]> {
  return apiRequest<SideTask[]>('/side-tasks/my');
}

export async function getAllSideTasks(query?: {
  status?: string;
  customerId?: string;
  priority?: string;
  stageTypeId?: string;
  search?: string;
}): Promise<SideTask[]> {
  const params = new URLSearchParams();
  if (query?.status) params.append('status', query.status);
  if (query?.customerId) params.append('customerId', query.customerId);
  if (query?.priority) params.append('priority', query.priority);
  if (query?.stageTypeId) params.append('stageTypeId', query.stageTypeId);
  if (query?.search) params.append('search', query.search);

  const queryString = params.toString();
  const url = `/side-tasks/all${queryString ? `?${queryString}` : ''}`;
  return apiRequest<SideTask[]>(url);
}

export async function getCompletedSideTasks(): Promise<SideTask[]> {
  return apiRequest<SideTask[]>('/side-tasks/completed');
}

export async function getSideTask(id: string): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}`);
}

export async function updateSideTask(
  id: string,
  payload: UpdateSideTaskPayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function startSideTaskStage(id: string): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/stages/start`, {
    method: 'POST',
  });
}

export async function pauseSideTaskStage(id: string): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/stages/pause`, {
    method: 'POST',
  });
}

export async function resumeSideTaskStage(id: string): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/stages/resume`, {
    method: 'POST',
  });
}

export async function passSideTaskStage(
  id: string,
  payload: PassStagePayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/stages/pass`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function reassignSideTaskStage(
  id: string,
  payload: ReassignStagePayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/stages/reassign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitSideTaskReview(
  id: string,
  payload: SubmitReviewPayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/review/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function approveSideTaskReview(id: string): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/review/approve`, {
    method: 'POST',
  });
}

export async function sendBackSideTaskReview(
  id: string,
  payload: SendBackReviewPayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/review/send-back`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function abandonSideTask(
  id: string,
  payload?: AbandonSideTaskPayload,
): Promise<SideTask> {
  return apiRequest<SideTask>(`/side-tasks/${id}/abandon`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

export async function uploadSideTaskImages(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map(async (file) => {
    const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string; publicUrl: string }>(
      `/orders/upload-url?filename=${encodeURIComponent(file.name)}&folder=side-tasks`
    );
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
    });
    return publicUrl;
  });
  return Promise.all(uploadPromises);
}

export async function deleteSideTask(id: string): Promise<{ message: string; id: string }> {
  return apiRequest<{ message: string; id: string }>(`/side-tasks/${id}`, {
    method: 'DELETE',
  });
}

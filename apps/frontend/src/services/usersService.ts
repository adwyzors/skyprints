import { apiRequest } from './api.service';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  locationId: string | null;
  location: { id: string; code: string; name: string } | null;
  createdAt: string;
  login: {
    username: string | null;
    permissions: string[];
    isActive: boolean;
    lastLoginAt: string | null;
    failedLoginAttempts: number;
    lastFailedLoginAt: string | null;
    createdAt: string;
  } | null;
}

export interface UserDetail extends UserListItem {}

export interface UserMe {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  location: { id: string; code: string; name: string } | null;
  permissions: string[];
  lastLoginAt: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  username?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';
  locationId?: string;
  password: string;
  permissions?: string[];
}

export interface UpdateUserPayload {
  name?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';
  locationId?: string | null;
  isActive?: boolean;
  username?: string | null;
}

export interface UpdatePermissionsPayload {
  permissions: string[];
}

export interface ResetPasswordPayload {
  password: string;
}

export async function listUsers(): Promise<UserListItem[]> {
  return apiRequest<UserListItem[]>('/users');
}

export async function getUser(id: string): Promise<UserDetail> {
  return apiRequest<UserDetail>(`/users/${id}`);
}

export async function getMe(): Promise<UserMe> {
  return apiRequest<UserMe>('/users/me');
}

export async function createUser(payload: CreateUserPayload): Promise<UserDetail> {
  return apiRequest<UserDetail>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<UserDetail> {
  return apiRequest<UserDetail>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePermissions(
  id: string,
  payload: UpdatePermissionsPayload,
): Promise<void> {
  await apiRequest<void>(`/users/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await apiRequest<void>(`/users/${id}`, { method: 'DELETE' });
}

export async function revokeSession(id: string): Promise<void> {
  await apiRequest<void>(`/users/${id}/revoke-session`, { method: 'POST' });
}

export async function resetPassword(
  id: string,
  payload: ResetPasswordPayload,
): Promise<void> {
  await apiRequest<void>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

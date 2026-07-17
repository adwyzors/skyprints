import { apiRequest } from './api.service';

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export async function getManagers(): Promise<User[]> {
    const res = await apiRequest<{ data: User[] }>('/internal/users?role=MANAGER', {
        method: 'GET',
    });
    return res.data || [];
}

export async function getManagersAndAdmins(): Promise<User[]> {
    const res = await apiRequest<{ data: User[] }>('/internal/users?role=MANAGER,ADMIN,SUPER_ADMIN', {
        method: 'GET',
    });
    return res.data || [];
}

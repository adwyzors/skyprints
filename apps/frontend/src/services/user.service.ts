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
    return apiRequest<User[]>('/internal/users?role=MANAGER', {
        method: 'GET',
    });
}

export async function getManagersAndAdmins(): Promise<User[]> {
    return apiRequest<User[]>('/internal/users?role=MANAGER,ADMIN', {
        method: 'GET',
    });
}

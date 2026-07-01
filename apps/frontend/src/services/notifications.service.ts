import { apiRequest } from './api.service';

export interface AppNotification {
  id: string;
  orderId: string;
  orderCode: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>('/notifications');
}

export async function markNotificationAsRead(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/notifications/read-all', {
    method: 'POST',
  });
}

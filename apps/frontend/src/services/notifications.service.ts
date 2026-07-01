import { apiRequest, apiRequestWithHeaders } from './api.service';

export interface AppNotification {
  id: string;
  orderId: string;
  orderCode: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  orderStatus?: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchNotifications(limit = 10): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>(`/notifications?page=1&limit=${limit}`);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count } = await apiRequest<{ count: number }>('/notifications/unread-count');
  return count;
}

export async function fetchNotificationsPage(page: number, limit: number): Promise<NotificationsPage> {
  const { data, headers } = await apiRequestWithHeaders<AppNotification[]>(
    `/notifications?page=${page}&limit=${limit}`,
  );

  return {
    notifications: data,
    total: parseInt(headers.get('x-total-count') || '0', 10),
    page: parseInt(headers.get('x-page') || String(page), 10),
    limit: parseInt(headers.get('x-limit') || String(limit), 10),
    totalPages: parseInt(headers.get('x-total-pages') || '1', 10),
  };
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

/**
 * Order this notification refers to may have moved past the stage the
 * notification was raised for — resolveNotificationTarget() reports that
 * via blockedMessage instead of pushing a stale link.
 */
export function resolveNotificationTarget(
  notif: AppNotification,
): { path: string; blockedMessage?: string } {
  const isConfigureNotif = notif.message.toLowerCase().includes('configure');

  if (isConfigureNotif) {
    if (notif.orderStatus && notif.orderStatus !== 'CONFIGURE') {
      return {
        path: `/admin/orders/${notif.orderId}`,
        blockedMessage: `Order ${notif.orderCode} has already been configured.`,
      };
    }
    return { path: `/admin/orders/${notif.orderId}` };
  }

  if (notif.orderStatus && notif.orderStatus !== 'COMPLETE') {
    return {
      path: `/admin/billing?selectedOrder=${notif.orderId}`,
      blockedMessage: `Order ${notif.orderCode} has already been finalized and billed.`,
    };
  }
  return { path: `/admin/billing?selectedOrder=${notif.orderId}` };
}

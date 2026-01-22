// services/billing.service.ts
import { BillingSnapshot } from '@/domain/model/billing.model';
import { apiRequest } from './api.service';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Get latest billing snapshot - handles null response when no snapshot exists
 */
export const getLatestBillingSnapshot = async (orderId: string): Promise<BillingSnapshot | null> => {
  const response = await fetch(`${API_BASE_URL}/billing/snapshots/latest`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch billing snapshot');
  }

  const text = await response.text();
  if (!text || text === 'null') {
    return null;
  }
  return JSON.parse(text) as BillingSnapshot;
};

export const updateBillingSnapshot = async (orderId: string, data: BillingSnapshot): Promise<BillingSnapshot> => {
  return apiRequest<BillingSnapshot>(`/billing/snapshots/${orderId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const createBillingSnapshot = async (orderId: string): Promise<BillingSnapshot> => {
  return apiRequest<BillingSnapshot>(`/billing/snapshots/${orderId}`, {
    method: 'POST',
  });
};
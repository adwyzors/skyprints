// services/billing.service.ts
import { BillingContextDetails, BillingSnapshot, GetBillingContextsResponse } from '@/domain/model/billing.model';
import { apiRequest, apiRequestWithHeaders } from './api.service';

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
    console.log(response);
    alert('Failed to fetch billing snapshot');
    //throw new Error('Failed to fetch billing snapshot');
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

export interface CreateBillingContextPayload {
  type: 'GROUP';
  name: string;
  description?: string;
  orderIds: string[];
}

export const createBillingContext = async (
  data: CreateBillingContextPayload
): Promise<{ id: string }> => {
  return apiRequest<{ id: string }>('/billing/contexts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const getBillingContexts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<GetBillingContextsResponse> => {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.limit) query.append('limit', params.limit.toString());
  if (params?.search) query.append('search', params.search);

  const queryString = query.toString();
  const url = queryString ? `/billing/contexts?${queryString}` : '/billing/contexts';

  const { data, headers } = await apiRequestWithHeaders<{ data: any[] }>(url, {
    method: 'GET',
  });

  // Extract pagination metadata from headers
  const page = parseInt(headers.get('x-page') || '1', 10);
  const limit = parseInt(headers.get('x-limit') || '12', 10);
  const total = parseInt(headers.get('x-total') || '0', 10);
  const totalPages = parseInt(headers.get('x-total-pages') || '0', 10);

  return {
    data: data.data,
    page,
    limit,
    total,
    totalPages,
  };
};

export const getBillingContextById = async (id: string): Promise<BillingContextDetails> => {
  return apiRequest<BillingContextDetails>(`/billing/contexts/${id}`, {
    method: 'GET',
  });
};

export const finalizeBillingGroup = async (contextId: string): Promise<void> => {
  return apiRequest<void>('/billing/finalize/group', {
    method: 'POST',
    body: JSON.stringify({ billingContextId: contextId }),
  });
};
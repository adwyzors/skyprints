// services/orders.service.ts
import { mapOrderSummaryDtoToOrder } from "@/domain/mapper/order/order.mapper";
import { Order } from "@/domain/model/order.model";
import { NewOrderPayload } from "@/types/planning";
import {
  OrderSummaryDto,
  OrderSummarySchema
} from "@app/contracts";
import { apiRequest, apiRequestWithHeaders } from "./api.service";

export interface GetOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface GetOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* =====================================================
 * GET ALL ORDERS WITH FILTERS AND PAGINATION
 * ===================================================== */

export async function getOrders(params: GetOrdersParams = {}): Promise<GetOrdersResponse> {
  const queryParams = new URLSearchParams();

  const requestedPage = params.page || 1;
  const requestedLimit = params.limit || 12;

  queryParams.append('page', requestedPage.toString());
  queryParams.append('limit', requestedLimit.toString());
  if (params.status && params.status !== 'all') queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);
  if (params.customerId) queryParams.append('customerId', params.customerId);
  if (params.fromDate) queryParams.append('fromDate', params.fromDate);
  if (params.toDate) queryParams.append('toDate', params.toDate);

  const queryString = queryParams.toString();
  const url = queryString ? `/orders?${queryString}` : '/orders';

  const { data: res, headers } = await apiRequestWithHeaders<any>(url);

  // Extract orders array from response (handle different formats)
  let ordersArray: OrderSummaryDto[];
  if (res.data && Array.isArray(res.data)) {
    ordersArray = res.data;
  } else if (Array.isArray(res)) {
    ordersArray = res;
  } else if (res.orders && Array.isArray(res.orders)) {
    ordersArray = res.orders;
  } else {
    console.error('Unexpected API response format:', res);
    throw new Error('Invalid response format from server');
  }

  // Extract pagination from headers
  const total = parseInt(headers.get('x-total-count') || String(ordersArray.length), 10);
  const page = parseInt(headers.get('x-page') || String(requestedPage), 10);
  const limit = parseInt(headers.get('x-limit') || String(requestedLimit), 10);
  const totalPages = parseInt(headers.get('x-total-pages') || '1', 10);

  const dtos = OrderSummarySchema.array().parse(ordersArray);

  console.log('Orders API - Pagination:', { page, limit, total, totalPages, ordersCount: dtos.length });

  return {
    orders: dtos.map(mapOrderSummaryDtoToOrder),
    total,
    page,
    limit,
    totalPages,
  };
}

/* =====================================================
 * GET ORDER BY ID
 * ===================================================== */

export async function getOrderById(id: string): Promise<Order> {
  const res = await apiRequest<OrderSummaryDto>(`/orders/${id}`);

  const dto = OrderSummarySchema.parse(res);

  return mapOrderSummaryDtoToOrder(dto);
}

/* =====================================================
 * CREATE ORDER
 * ===================================================== */

export async function createOrder(
  payload: NewOrderPayload
): Promise<any> {
  const formData = new FormData();

  // Add required fields
  formData.append('customerId', payload.customerId);
  formData.append('quantity', payload.quantity.toString());
  formData.append('processes', JSON.stringify(payload.processes));

  // Add optional fields
  if (payload.jobCode) {
    formData.append('jobCode', payload.jobCode);
  }

  // Add images
  if (payload.images && payload.images.length > 0) {
    payload.images.forEach((file) => {
      formData.append('images', file);
    });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    // Do not set Content-Type header when using FormData; browser sets it automatically with boundary
    headers: {
      // Add Authorization header if needed, assuming it's handled globally or we need to add it here
      // For now, let's assume apiRequestWithHeaders handles auth but we are using fetch directly
      // We might need to get the token. 
      // Checking api.service.ts implementation in next step to be sure about Auth.
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create order' }));
    throw new Error(error.message || 'Failed to create order');
  }

  return res.json();
}


// services/orders.service.ts
import { mapOrderSummaryDtoToOrder } from "@/domain/mapper/order/order.mapper";
import { Order } from "@/domain/model/order.model";
import { NewOrderPayload } from "@/types/planning";
import {
  CreateOrderDto,
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

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.status && params.status !== 'all') queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);
  if (params.customerId) queryParams.append('customerId', params.customerId);
  if (params.fromDate) queryParams.append('fromDate', params.fromDate);
  if (params.toDate) queryParams.append('toDate', params.toDate);

  const queryString = queryParams.toString();
  const url = queryString ? `/orders?${queryString}` : '/orders';

  const { data: res, headers } = await apiRequestWithHeaders<
    OrderSummaryDto[] | { orders: OrderSummaryDto[] }
  >(url);

  // Handle both array response and wrapped object response
  const ordersArray = Array.isArray(res) ? res : res.orders;

  // DEBUG: Log the response to see what we're getting
  console.log('getOrders API response:', {
    res, headers: {
      total: headers.get('x-total-count'),
      page: headers.get('x-page'),
      limit: headers.get('x-limit'),
      totalPages: headers.get('x-total-pages'),
    }
  });

  // Validate response structure
  if (!ordersArray || !Array.isArray(ordersArray)) {
    console.error('Invalid response - ordersArray is:', ordersArray, 'Full res:', res);
    throw new Error('Invalid response format from server');
  }

  const dtos = OrderSummarySchema.array().parse(ordersArray);

  // Extract pagination from headers (with fallbacks)
  const total = parseInt(headers.get('x-total-count') || String(dtos.length), 10);
  const page = parseInt(headers.get('x-page') || '1', 10);
  const limit = parseInt(headers.get('x-limit') || '20', 10);
  const totalPages = parseInt(headers.get('x-total-pages') || '1', 10);

  console.log('getOrders returning:', { ordersCount: dtos.length, total, page, limit, totalPages });

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
  const apiPayload: CreateOrderDto = {
    customerId: payload.customerId,
    quantity: payload.quantity,
    processes: payload.processes,
  };

  const res = await apiRequest<any>("/orders", {
    method: "POST",
    body: JSON.stringify(apiPayload),
  });

  return res;
}
// services/orders.service.ts
import { mapOrderSummaryDtoToOrder } from "@/domain/mapper/order/order.mapper";
import { Order } from "@/domain/model/order.model";
import { NewOrderPayload } from "@/types/planning";
import {
    CreateOrderDto,
    OrderSummaryDto,
    OrderSummarySchema
} from "@app/contracts";
import { apiRequest } from "./api.service";

/* =====================================================
 * GET ALL ORDERS
 * ===================================================== */

export async function getOrders(): Promise<Order[]> {
    const res = await apiRequest<OrderSummaryDto[]>("/orders");

    const dtos = OrderSummarySchema.array().parse(res);

    return dtos.map(mapOrderSummaryDtoToOrder);
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

    // The server returns { id: "...", status: "CREATED" } which doesn't match OrderSummarySchema
    // We return the raw response because the calling component will likely refresh the list anyway
    return res;
}

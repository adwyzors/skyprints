// services/orders.service.ts
import { mapOrderSummaryDtoToOrder } from "@/domain/mapper/order/order.mapper";
import { Order } from "@/domain/model/order.model";
import { NewOrderPayload } from "@/types/planning";
import {
    OrderSummarySchema,
    OrderSummaryDto,
    CreateOrderSchema,
    CreateOrderDto,
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
): Promise<Order> {
    const apiPayload: CreateOrderDto = {
        customerId: payload.customerId,
        quantity: payload.quantity,
        processes: payload.processes,
    };

    const res = await apiRequest<CreateOrderDto>("/orders", {
        method: "POST",
        body: JSON.stringify(apiPayload),
    });

    const dto = OrderSummarySchema.parse(res);

    return mapOrderSummaryDtoToOrder(dto);
}

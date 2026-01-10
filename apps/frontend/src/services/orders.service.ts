import { OrderCreateDtoSchema } from "@/dto/order/order.create.dto";
import { OrderDetailDtoSchema } from "@/dto/order/order.detail.dto";
import { OrderListDtoSchema } from "@/dto/order/order.list.dto";
import { mapOrderCreateDtoToModel } from "@/mapper/order/order-create.mapper";
import { mapOrderDetailDtoToModel } from "@/mapper/order/order-detail.mapper";
import { mapOrderListDtoToModel } from "@/mapper/order/order-list.mapper";
import { Order } from "@/model/order.model";
import { NewOrderPayload } from "@/types/planning";
import { apiRequest } from "./api.service";



export async function getOrders(): Promise<Order[]> {
    const res = await apiRequest("/orders")

    const dtos = OrderListDtoSchema.array().parse(res)

    return dtos.map(mapOrderListDtoToModel)
}

export async function getOrderById(id: string): Promise<Order> {
    const res = await apiRequest(`/orders/${id}`)

    const dto = OrderDetailDtoSchema.parse(res)

    return mapOrderDetailDtoToModel(dto)
}

export async function createOrder(
    payload: NewOrderPayload
): Promise<Order> {
    const apiPayload = {
        customerId: payload.customerId,
        quantity: payload.quantity,
        processes: payload.processes,
    };

    const res = apiRequest<Order>("/orders", {
        method: "POST",
        body: JSON.stringify(apiPayload),
    });
    const dto = OrderCreateDtoSchema.parse(res);
    return mapOrderCreateDtoToModel(dto);
}

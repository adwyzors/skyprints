import { OrderListDto } from "../../dto/order/order.list.dto"
import { Order } from "../../model/order.model"
import { mapOrderProcessDtoToModel } from "../process/process.mapper"

export function mapOrderListDtoToModel(
    dto: OrderListDto
): Order {
    return {
        id: dto.id,
        code: dto.orderCode,
        quantity: dto.quantity,
        status: dto.statusCode,
        totalAmount: dto.totalAmount,
        createdAt: new Date(dto.createdAt),
        updatedAt: new Date(dto.updatedAt),
        processes: dto.processes.map(mapOrderProcessDtoToModel),


    }
}

import { OrderCreateDto } from "@/dto/order/order.create.dto"
import { Order } from "../../model/order.model"

export function mapOrderCreateDtoToModel(
    dto: OrderCreateDto
): Order {
    return {
        id: dto.id,
        code: dto.orderCode,
        quantity: dto.quantity,
        status: dto.statusCode,
        totalAmount: dto.totalAmount,
        createdAt: new Date(dto.createdAt),
        updatedAt: new Date(dto.updatedAt),
        processes: []
    }
}

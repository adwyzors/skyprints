import { OrderDetailDto } from "../../dto/order/order.detail.dto"
import { Order } from "../../model/order.model"
import { mapCustomerDtoToModel } from "../customer/customer.mapper"
import { mapProcessDtoToModel } from "../process/process.mapper"

export function mapOrderDetailDtoToModel(
    dto: OrderDetailDto
): Order {
    return {
        id: dto.id,
        code: dto.orderCode,
        quantity: dto.quantity,
        status: dto.statusCode,
        totalAmount: dto.totalAmount,
        createdAt: new Date(dto.createdAt),
        updatedAt: new Date(dto.updatedAt),

        customer: mapCustomerDtoToModel(dto.customer),
        processes: dto.processes.map(mapProcessDtoToModel),
    }
}

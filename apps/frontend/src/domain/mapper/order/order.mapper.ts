import { Order, OrderProcess } from '@/domain/model/order.model';
import { OrderSummaryDto } from '@app/contracts';
import { mapProcessRunDto } from '../run/run.mapper';

export const mapOrderSummaryDtoToOrder = (
    dto: OrderSummaryDto
): Order => ({
    id: dto.id,
    quantity: dto.quantity,
    status: dto.status,
    createdAt: new Date(dto.createdAt),
    customer: dto.customer,
    processes: dto.processes.map(mapOrderProcessDto),
});

const mapOrderProcessDto = (
    process: OrderSummaryDto['processes'][number]
): OrderProcess => ({
    id: process.id,
    name: process.name,
    status: process.status,
    runs: process.runs.map(mapProcessRunDto),
});

import { Order, OrderProcess } from '@/domain/model/order.model';
import { OrderSummaryDto } from '@app/contracts';
import { mapProcessRunDto } from '../run/run.mapper';

export const mapOrderSummaryDtoToOrder = (
    dto: OrderSummaryDto
): Order => ({
    id: dto.id,
    code: dto.code,
    quantity: dto.quantity,
    status: dto.status,
    createdAt: new Date(dto.createdAt),
    customer: dto.customer,
    processes: dto.processes.map(mapOrderProcessDto),
    completedProcesses: dto.completedProcesses ?? 0,
    totalProcesses: dto.totalProcesses,
    jobCode: dto.jobCode ?? "",
    images: dto.images ?? []
});

const mapOrderProcessDto = (
    process: OrderSummaryDto['processes'][number]
): OrderProcess => ({
    id: process.id,
    name: process.name,
    status: process.status,
    runs: process.runs.map(mapProcessRunDto),
    processId: process.processId
});

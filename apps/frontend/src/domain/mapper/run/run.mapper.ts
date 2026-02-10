import { ProcessRun, RunField } from '@/domain/model/run.model';
import type { OrderProcessRunDto } from '@app/contracts';

export const mapProcessRunDto = (
    dto: OrderProcessRunDto
): ProcessRun => ({
    id: dto.id,
    runNumber: dto.runNumber,
    displayName: dto.displayName,
    configStatus: dto.configStatus,
    lifecycleStatus: dto.lifecycleStatus,
    lifecycle: dto.lifecycle ?? [],
    values: dto.values,
    fields: dto.fields.map(mapRunField),
    executor: dto.executor ? { id: dto.executor.id, name: dto.executor.name } : null,
    reviewer: dto.reviewer ? { id: dto.reviewer.id, name: dto.reviewer.name } : null,
    location: dto.location ? { id: dto.location.id, code: dto.location.code, name: dto.location.name } : null,
});

const mapRunField = (field: any): RunField => ({
    key: field.key,
    type: field.type,
    required: field.required,
});

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
    values: dto.values,
    fields: dto.fields.map(mapRunField),
});

const mapRunField = (field: any): RunField => ({
    key: field.key,
    type: field.type,
    required: field.required,
});

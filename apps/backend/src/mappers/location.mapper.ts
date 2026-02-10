import { LocationSummaryDto } from '@app/contracts';
import { Location } from '@prisma/client';

export function toLocationSummary(entity: Location): LocationSummaryDto {
    return {
        id: entity.id,
        code: entity.code,
        name: entity.name,
        description: entity.description,
        type: entity.type,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
    };
}

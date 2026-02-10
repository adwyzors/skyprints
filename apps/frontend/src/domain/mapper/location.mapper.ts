import { LocationSummaryDto } from '@app/contracts';
import { Location } from '../model/location.model';

export function mapLocationSummaryDtosToLocations(dtos: LocationSummaryDto[]): Location[] {
    return dtos.map(dto => ({
        id: dto.id,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isActive: dto.isActive,
        createdAt: new Date(dto.createdAt), // Ensure Date object
        updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
    }));
}

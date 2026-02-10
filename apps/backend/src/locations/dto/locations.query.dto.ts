import { QueryLocationDto as ContractDto } from '@app/contracts';

export class LocationsQueryDto implements ContractDto {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
}

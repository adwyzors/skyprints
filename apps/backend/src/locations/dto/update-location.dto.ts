import { UpdateLocationDto as ContractDto } from '@app/contracts';

export class UpdateLocationDto implements ContractDto {
    code?: string;
    name?: string;
    description?: string | null;
    type?: string;
    isActive?: boolean;
}

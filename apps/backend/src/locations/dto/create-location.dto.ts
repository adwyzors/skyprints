import { CreateLocationDto as ContractDto } from '@app/contracts';

export class CreateLocationDto implements ContractDto {
    code: string;
    name: string;
    description?: string | null;
    type: string;
    isActive: boolean;
}

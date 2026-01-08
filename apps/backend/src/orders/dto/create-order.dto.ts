import {
    IsString,
    IsInt,
    Min,
    ValidateNested,
    IsUUID,
    ArrayMinSize,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class RunSelectionDto {
    @IsUUID()
    runTemplateId: string;

    @IsInt()
    @Min(1)
    count: number;
}

class ProcessDto {
    @IsString()
    processName: string;

    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => RunSelectionDto)
    runs: RunSelectionDto[];
}

export class CreateOrderDto {
    @IsString()
    customerName: string;
    @IsInt()
    @Min(1)
    quantity: number;

    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('all', { each: true })
    processIds: string[];
}


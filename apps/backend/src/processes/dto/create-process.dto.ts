import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

class RunDefinitionDto {
    @IsString()
    displayName: string;

    @IsUUID()
    runTemplateId: string;

    @IsNumber()
    sortOrder: number;
}

export class CreateProcessDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    lifeCycle: string[];

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RunDefinitionDto)
    runDefinitions: RunDefinitionDto[];
}



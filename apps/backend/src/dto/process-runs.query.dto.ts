import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    Min
} from 'class-validator';

export class ProcessRunsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit: number = 20;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    status?: string;

    // ====== FILTERS (UUIDs) ======

    @IsOptional()
    @IsString()
    customerId?: string;

    @IsOptional()
    @IsString()
    executorUserId?: string;

    @IsOptional()
    @IsString()
    reviewerUserId?: string;

    @IsOptional()
    @IsString()
    assignedUserId?: string;

    @IsOptional()
    @IsString()
    lifeCycleStatusCode?: string;

    @IsOptional()
    @IsString()
    priority?: string;

    @IsOptional()
    @IsString()
    createdFrom?: string;

    @IsOptional()
    @IsString()
    createdTo?: string;

    @IsOptional()
    @IsString()
    processId?: string;

    @IsOptional()
    @IsString()
    locationId?: string;
}

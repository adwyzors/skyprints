import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Min,
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
    @IsIn(['CONFIGURE', 'COMPLETE'])
    status?: 'CONFIGURE' | 'COMPLETE';

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
    lifeCycleStatusCode?: string;

    @IsOptional()
    @IsIn(['HIGH', 'MEDIUM', 'LOW'])
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';

    @IsOptional()
    @IsString()
    createdFrom?: string;

    @IsOptional()
    @IsString()
    createdTo?: string;
}

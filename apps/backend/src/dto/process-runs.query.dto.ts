import { Type } from 'class-transformer';
import {
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
    search?: string; // Search by order code, customer name, template name

    @IsOptional()
    @IsString()
    status?: string; // Comma-separated status codes
}

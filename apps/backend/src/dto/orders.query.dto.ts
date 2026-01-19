import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class OrdersQueryDto {
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

  /**
   * Single or comma-separated status codes
   * Example: COMPLETED or COMPLETED,IN_PRODUCTION
   */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string; // order code search

  @IsOptional()
  @IsString()
  fromDate?: string; // ISO date

  @IsOptional()
  @IsString()
  toDate?: string; // ISO date
}

import { IsBoolean, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCustomerDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit = 20;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

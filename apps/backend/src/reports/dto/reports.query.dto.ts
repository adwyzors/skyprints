import { IsOptional, IsString } from "class-validator";

export class ReportsQueryDto {
    @IsOptional()
    @IsString()
    customerId?: string;

    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    endDate?: string;

    @IsOptional()
    @IsString()
    processId?: string;
    
    @IsOptional()
    @IsString()
    preProductionLocationId?: string;

    @IsOptional()
    @IsString()
    postProductionLocationId?: string;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;
}

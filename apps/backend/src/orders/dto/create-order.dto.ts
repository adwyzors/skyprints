import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

class OrderProcessInputDto {
    @IsString()
    @IsNotEmpty()
    processId: string;

    @IsInt()
    @Min(1)
    count: number;
}

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderProcessInputDto)
    processes: OrderProcessInputDto[];
}

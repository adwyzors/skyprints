import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
    @IsString()
    code: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

import { IsOptional, IsString } from 'class-validator';

export class UsersQueryDto {
    /**
     * Single or comma-separated roles
     * Example: ADMIN or ADMIN,OPERATOR
     */
    @IsOptional()
    @IsString()
    role?: string;
}

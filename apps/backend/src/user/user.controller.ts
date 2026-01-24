import {
    AssignLocationSchema,
    SoftDeleteUserSchema,
    SyncUserSchema,
} from '@app/contracts';
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Post,
} from '@nestjs/common';
import { UserService } from './user.service';

@Controller('internal/users')
export class UserController {
    constructor(private readonly service: UserService) { }

    @Post()
    async sync(@Body() body: unknown) {
        const parsed = SyncUserSchema.safeParse(body);
        if (!parsed.success) {
            throw new BadRequestException(parsed.error.flatten());
        }
        return this.service.syncUser(parsed.data);
    }

    @Delete()
    async softDelete(@Body() body: unknown) {
        const parsed = SoftDeleteUserSchema.safeParse(body);
        if (!parsed.success) {
            throw new BadRequestException(parsed.error.flatten());
        }
        await this.service.softDeleteByEmail(parsed.data.email);
        return { status: 'deleted' };
    }

    @Post('location')
    async assignLocation(@Body() body: unknown) {
        const parsed = AssignLocationSchema.safeParse(body);
        if (!parsed.success) {
            throw new BadRequestException(parsed.error.flatten());
        }
        return this.service.assignLocation(parsed.data);
    }
}

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
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { UsersQueryDto } from '../dto/users-query.dto';
import { UserService } from './user.service';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('internal/users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Post()
  @Permissions('users:create')
  async sync(@Body() body: unknown) {
    const parsed = SyncUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.syncUser(parsed.data);
  }

  @Delete()
  @Permissions('users:delete')
  async softDelete(@Body() body: unknown) {
    const parsed = SoftDeleteUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.service.softDeleteByEmail(parsed.data.email);
    return { status: 'deleted' };
  }

  @Post('location')
  @Permissions('users:update')
  async assignLocation(@Body() body: unknown) {
    const parsed = AssignLocationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.assignLocation(parsed.data);
  }

  @Get()
  @Permissions('users:view')
  async getAll(@Query() query: UsersQueryDto) {
    return this.service.getAll(query);
  }
}

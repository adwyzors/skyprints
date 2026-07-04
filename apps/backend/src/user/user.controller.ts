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
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
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

  // Used by the executor/reviewer picker on Configure Run — deliberately allows
  // either the full user-management permission or the scoped picker-only one,
  // so granting 'users:view:basic' doesn't require also granting 'users:view'.
  @Get()
  async getAll(@Query() query: UsersQueryDto, @Req() req: any) {
    const permissions: string[] = req.user?.permissions ?? [];
    if (
      !permissions.includes('users:view') &&
      !permissions.includes('users:view:basic')
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.service.getAll(query);
  }
}

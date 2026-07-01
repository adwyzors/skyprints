import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  AssignStagePermissionsSchema,
  CreateUserSchema,
  ResetPasswordSchema,
  UpdatePermissionsSchema,
  UpdateUserSchema,
} from '@app/contracts';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Permissions('users:view')
  list(@Req() req: any) {
    return this.service.list(req.user.id);
  }

  @Get('me')
  me(@Req() req: any) {
    return this.service.findMe(req.user.id);
  }

  @Get(':id')
  @Permissions('users:view')
  findById(@Param('id') id: string, @Req() req: any) {
    return this.service.findById(id, req.user.id);
  }

  @Post()
  @Permissions('users:create')
  async create(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.create(parsed.data, req.user.permissions ?? [], req.user.id);
  }

  @Patch(':id')
  @Permissions('users:update')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.update(id, parsed.data, req.user.id);
  }

  @Patch(':id/permissions')
  @Permissions('users:permissions:manage')
  @HttpCode(204)
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = UpdatePermissionsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.service.updatePermissions(req.user.id, id, parsed.data);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @HttpCode(204)
  async softDelete(@Param('id') id: string, @Req() req: any) {
    await this.service.softDelete(id, req.user.id);
  }

  @Post(':id/revoke-session')
  @Permissions('users:session:revoke')
  @HttpCode(204)
  async revokeSession(@Param('id') id: string, @Req() req: any) {
    await this.service.revokeSession(req.user.id, id);
  }

  @Post(':id/reset-password')
  @Permissions('users:password:reset')
  @HttpCode(204)
  async resetPassword(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.service.resetPassword(id, parsed.data, req.user.id);
  }

  @Get(':id/stage-permissions')
  @Permissions('users:view')
  async getStagePermissions(@Param('id') id: string) {
    return this.service.getStagePermissions(id);
  }

  @Put(':id/stage-permissions')
  @Permissions('users:stage-permissions:manage')
  @HttpCode(204)
  async updateStagePermissions(@Param('id') id: string, @Body() body: unknown) {
    const parsed = AssignStagePermissionsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.service.updateStagePermissions(id, parsed.data);
  }
}

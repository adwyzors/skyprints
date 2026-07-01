import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ManagerQueueService } from './manager-queue.service';

@Controller('manager-queue')
export class ManagerQueueController {
  constructor(private readonly service: ManagerQueueService) {}

  @Get()
  @Permissions('runs:view')
  async listQueue(@Req() req: any) {
    return this.service.listQueue(req.user.id);
  }

  @Get('active')
  @Permissions('runs:view')
  async listActive(@Req() req: any) {
    return this.service.listActive(req.user.id);
  }

  @Post(':runId/claim')
  @Permissions('runs:lifecycle:update')
  async claim(@Param('runId') runId: string, @Req() req: any) {
    await this.service.claim(req.user.id, runId);
    return { success: true };
  }

  @Post(':runId/release')
  @Permissions('runs:lifecycle:update')
  async release(@Param('runId') runId: string, @Req() req: any) {
    await this.service.release(req.user.id, runId);
    return { success: true };
  }

  @Post(':runId/complete')
  @Permissions('runs:lifecycle:update')
  async complete(@Param('runId') runId: string, @Req() req: any) {
    return this.service.complete(req.user.id, runId);
  }

  @Post(':runId/force-release')
  @Permissions('runs:claim:override')
  async forceRelease(@Param('runId') runId: string, @Req() req: any) {
    await this.service.forceRelease(req.user.id, runId);
    return { success: true };
  }
}

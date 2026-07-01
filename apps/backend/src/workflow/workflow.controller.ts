import { Controller, Post, Param, Body } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TransitionDto } from './dto/transition.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Post(':entityType/:entityId/transition')
  @Permissions('runs:lifecycle:update')
  async transition(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: TransitionDto,
  ) {
    await this.service.validateAndCreateEvent(
      { entityType: entityType as any, entityId },
      dto,
    );

    return { status: 'ACCEPTED' };
  }
}

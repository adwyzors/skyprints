import { Controller, Post, Param, Body } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TransitionDto } from './dto/transition.dto';

@Controller('workflow')
export class WorkflowController {
  constructor(
    private readonly service: WorkflowService,
  ) {}

  @Post(':entityType/:entityId/transition')
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

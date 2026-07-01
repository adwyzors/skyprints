import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RunsService } from './runs.service';

@Controller('api/orders/:orderId/processes/:processId/runs')
export class RunsController {
  constructor(private readonly service: RunsService) {}

  @Get()
  @Permissions('runs:view')
  async list(
    @Param('orderId') orderId: string,
    @Param('processId') processId: string,
  ) {
    return this.service.list(orderId, processId);
  }

  @Get(':runId')
  @Permissions('runs:view')
  async get(
    @Param('orderId') orderId: string,
    @Param('processId') processId: string,
    @Param('runId') runId: string,
  ) {
    return this.service.get(orderId, processId, runId);
  }
}

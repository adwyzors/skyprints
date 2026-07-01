import type {
  ConfigureProcessRunDto,
  CreateProcessDto,
  DeleteRunImageDto,
  LifeCycleStatusDto,
  ProcessDetailDto,
  ProcessRunListItemDto,
  ProcessSummaryDto,
  TransitionProcessRunDto,
} from '@app/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ContextLogger } from '../common/logger/context.logger';
import { ProcessRunsQueryDto } from '../dto/process-runs.query.dto';
import { toProcessDetail } from '../mappers/process.mapper';
import { AdminProcessService } from './admin-process.service';

@Controller('process')
export class AdminProcessController {
  private readonly logger = new ContextLogger(AdminProcessController.name);

  constructor(private readonly service: AdminProcessService) {}

  @Get('runs')
  @Permissions('runs:view')
  async getRuns(@Query() query: ProcessRunsQueryDto): Promise<{
    data: ProcessRunListItemDto[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      totalEstimatedAmount: number;
    };
  }> {
    return this.service.getAllRuns(query);
  }

  @Post()
  @Permissions('process:create')
  create(@Body() dto: CreateProcessDto) {
    return this.service.create(dto);
  }

  @Get(':processId/lifecycle-statuses')
  @Permissions('process:view')
  async getLifecycleStatuses(
    @Param('processId') processId: string,
  ): Promise<LifeCycleStatusDto[]> {
    return this.service.getLifeCycleStatusesByProcess(processId);
  }

  @Get(':id')
  @Permissions('process:view')
  async get(@Param('id') id: string): Promise<ProcessDetailDto> {
    return toProcessDetail(await this.service.getById(id));
  }

  @Get()
  @Permissions('process:view')
  async getAll(): Promise<ProcessSummaryDto[]> {
    return this.service.getAll();
  }

  @Get('runs/:id')
  @Permissions('runs:view')
  async getRun(@Param('id') id: string) {
    return this.service.getRunById(id);
  }

  @Post(':orderProcessId/runs/:processRunId/configure')
  @Permissions('runs:update')
  async configure(
    @Param('orderProcessId') orderProcessId: string,
    @Param('processRunId') processRunId: string,
    @Body() dto: ConfigureProcessRunDto,
  ) {
    this.logger.log(
      `[API] configure orderProcess=${orderProcessId} run=${processRunId} images=${dto.images?.length ?? 0}`,
    );

    return this.service.configure(orderProcessId, processRunId, dto);
  }

  @Post(':orderProcessId/runs/:processRunId/transition')
  @Permissions('runs:lifecycle:update')
  async transition(
    @Param('orderProcessId') orderProcessId: string,
    @Param('processRunId') processRunId: string,
    @Body() dto: TransitionProcessRunDto,
  ) {
    this.logger.log(
      `[API] transition orderProcess=${orderProcessId} run=${processRunId} → ${dto.statusCode}`,
    );

    return this.service.transition(
      orderProcessId,
      processRunId,
      dto.statusCode,
      dto.expectedDate,
    );
  }

  @Delete(':orderProcessId/runs/:processRunId/configure/images')
  @Permissions('runs:update')
  async deleteRunImage(
    @Param('orderProcessId') orderProcessId: string,
    @Param('processRunId') processRunId: string,
    @Body() dto: DeleteRunImageDto,
  ) {
    this.logger.log(
      `[API][DELETE_RUN_IMAGE] orderProcess=${orderProcessId} run=${processRunId}`,
    );

    return this.service.deleteRunImage(
      orderProcessId,
      processRunId,
      dto.imageUrl,
    );
  }
}

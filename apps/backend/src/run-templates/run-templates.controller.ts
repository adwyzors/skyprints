import type { CreateRunTemplateDto } from '@app/contracts';
import { RunTemplateDetailDto, RunTemplateSummaryDto } from '@app/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { toRunTemplateDetail } from '../mappers/run-template.mapper';
import { RunTemplatesService } from './run-templates.service';
import { ContextLogger } from '../common/logger/context.logger';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('/runs/templates')
export class RunTemplatesController {
  private readonly logger = new ContextLogger(RunTemplatesController.name);

  constructor(private readonly service: RunTemplatesService) {}

  @Post()
  @Permissions('process:create')
  create(@Body() dto: CreateRunTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('process:view')
  async list(): Promise<RunTemplateSummaryDto[]> {
    return this.service.list();
  }

  @Get(':id')
  @Permissions('process:view')
  async get(@Param('id') id: string): Promise<RunTemplateDetailDto> {
    const template = await this.service.get(id);
    return toRunTemplateDetail(template);
  }
}

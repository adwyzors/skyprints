import type { CreateRunTemplateDto } from '@app/contracts';
import { RunTemplateDetailDto, RunTemplateSummaryDto } from '@app/contracts';
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
} from '@nestjs/common';
import { toRunTemplateDetail } from '../mappers/run-template.mapper';
import { RunTemplatesService } from './run-templates.service';

@Controller('/runs/templates')
export class RunTemplatesController {
    private readonly logger = new Logger(RunTemplatesController.name);

    constructor(
        private readonly service: RunTemplatesService,
    ) { }

    @Post()
    create(@Body() dto: CreateRunTemplateDto) {
        return this.service.create(dto);
    }

    @Get()
    async list(): Promise<RunTemplateSummaryDto[]> {
        return this.service.list();
    }

    @Get(':id')
    async get(@Param('id') id: string): Promise<RunTemplateDetailDto> {
        const template = await this.service.get(id);
        return toRunTemplateDetail(template);
    }
}

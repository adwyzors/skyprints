import type {
    ConfigureProcessRunDto,
    CreateProcessDto,
    ProcessDetailDto,
    ProcessSummaryDto
} from '@app/contracts';
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
} from '@nestjs/common';
import { toProcessDetail } from '../mappers/process.mapper';
import { AdminProcessService } from './admin-process.service';

@Controller('process')
export class AdminProcessController {
    private readonly logger = new Logger(AdminProcessController.name);

    constructor(private readonly service: AdminProcessService) { }

    @Post()
    create(@Body() dto: CreateProcessDto) {
        return this.service.create(dto);
    }

    @Get(':id')
    async get(@Param('id') id: string): Promise<ProcessDetailDto> {
        return toProcessDetail(await this.service.getById(id));
    }

    @Get()
    async getAll(): Promise<ProcessSummaryDto[]> {
        return this.service.getAll();
    }

    @Post(':orderProcessId/runs/:processRunId/configure')
    async configure(
        @Param('orderProcessId') orderProcessId: string,
        @Param('processRunId') processRunId: string,
        @Body() dto: ConfigureProcessRunDto,
    ) {
        this.logger.log(
            `[API] configure orderProcess=${orderProcessId} run=${processRunId}`,
        );
        return this.service.configure(orderProcessId, processRunId, dto);
    }

    @Post(':orderProcessId/runs/:processRunId/transition')
    async transition(
        @Param('orderProcessId') orderProcessId: string,
        @Param('processRunId') processRunId: string,
    ) {
        this.logger.log(
            `[API] transition orderProcess=${orderProcessId} run=${processRunId}`,
        );
        return this.service.transition(orderProcessId, processRunId);
    }
}

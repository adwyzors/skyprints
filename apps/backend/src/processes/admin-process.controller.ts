import type {
    ConfigureProcessRunDto,
    CreateProcessDto,
    DeleteRunImageDto,
    ProcessDetailDto,
    ProcessSummaryDto,
    TransitionProcessRunDto
} from '@app/contracts';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post
} from '@nestjs/common';
import { ContextLogger } from '../common/logger/context.logger';
import { toProcessDetail } from '../mappers/process.mapper';
import { AdminProcessService } from './admin-process.service';

@Controller('process')
export class AdminProcessController {
    private readonly logger = new ContextLogger(AdminProcessController.name);

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
            `[API] configure orderProcess=${orderProcessId} run=${processRunId} images=${dto.images?.length ?? 0}`,
        );

        return this.service.configure(
            orderProcessId,
            processRunId,
            dto,
        );
    }

    @Post(':orderProcessId/runs/:processRunId/transition')
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
        );
    }

    @Delete(':orderProcessId/runs/:processRunId/configure/images')
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

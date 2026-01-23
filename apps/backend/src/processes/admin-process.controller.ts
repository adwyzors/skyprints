import type {
    ConfigureProcessRunDto,
    CreateProcessDto,
    ProcessDetailDto,
    ProcessSummaryDto, DeleteRunImageDto
} from '@app/contracts';
import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    Post,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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

    @Post(':orderProcessId/runs/:processRunId/configure/images')
    @UseInterceptors(
        FilesInterceptor('files', 2, {
            limits: { fileSize: 3 * 1024 * 1024 },
        }),
    )
    async uploadRunImages(
        @Param('orderProcessId') orderProcessId: string,
        @Param('processRunId') processRunId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.service.uploadRunImages(processRunId, files ?? []);
    }

    @Delete(':orderProcessId/runs/:processRunId/images')
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

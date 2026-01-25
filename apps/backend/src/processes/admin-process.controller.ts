import type {
    ConfigureProcessRunDto,
    CreateProcessDto,
    DeleteRunImageDto,
    ProcessDetailDto,
    ProcessSummaryDto
} from '@app/contracts';
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { toProcessDetail } from '../mappers/process.mapper';
import { AdminProcessService } from './admin-process.service';
import { ContextLogger } from '../common/logger/context.logger';

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
    @UseInterceptors(
        FilesInterceptor('images', 2, {
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async configure(
        @Param('orderProcessId') orderProcessId: string,
        @Param('processRunId') processRunId: string,
        @Body() dto: ConfigureProcessRunDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {

        this.logger.log(
            `[API] configure orderProcess=${orderProcessId} run=${processRunId} files=${files?.length ?? 0}`,
        );

        if (typeof dto.fields === 'string') {
            try {
                dto.fields = JSON.parse(dto.fields);
            } catch {
                throw new BadRequestException('Invalid JSON in fields');
            }
        }

        return this.service.configureWithImages(
            orderProcessId,
            processRunId,
            dto,
            files ?? [],
        );
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

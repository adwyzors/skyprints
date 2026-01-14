import type { ConfigureProcessRunDto, TransitionProcessRunDto } from '../../../packages/contracts/dist/process-run.configure.contract';
import type { CreateProcessDto } from '../../../packages/contracts/dist/process.contract';
import { ProcessDetailDto, ProcessSummaryDto } from '../../../packages/contracts/dist/process.read.contract';


import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post
} from '@nestjs/common';
import { toProcessDetail } from '../mappers/process.mapper';
import { AdminProcessService } from './admin-process.service';

@Controller('process')
export class AdminProcessController {
    private readonly logger = new Logger(AdminProcessController.name);

    constructor(
        private readonly service: AdminProcessService,
    ) { }

    @Post()
    create(@Body() dto: CreateProcessDto) {
        return this.service.create(dto);
    }

    @Get(':id')
    async get(@Param('id') id: string): Promise<ProcessDetailDto> {
        const process = await this.service.getById(id);
        return toProcessDetail(process);
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
            `Configuring orderProcess=${orderProcessId}, run=${processRunId}`,
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
            `Transitioning orderProcess=${orderProcessId}, run=${processRunId}`,
        );

        return this.service.transition(
            orderProcessId,
            processRunId,
            dto,
        );
    }



    //@Get(':orderProcessId/runs/:processRunId')
    //async getProcessRun(@Param('orderProcessId') orderProcessId: string, @Param('processRunId') processRunId: string) {
    //    this.logger.log(`Fetching process ${orderProcessId} with processRun ${processRunId}`);
    //    return this.service.getProcessRun(orderProcessId, processRunId);
    //}

    //@Put(':orderProcessId/transition')
    //async transitionOrderProcess(
    //    @Param('orderProcessId') orderProcessId: string,
    //) {
    //    this.logger.log(`Requesting OrderProcess transition: ${orderProcessId}`);
    //    return this.service.requestOrderProcessTransition(orderProcessId);
    //}

}

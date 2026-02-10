import {
    Body,
    Controller,
    Get,
    Param,
    Put
} from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller('api/orders/:orderId/processes/:processId/runs')
export class RunsController {
    constructor(
        private readonly service: RunsService,
    ) { }

    @Get()
    async list(
        @Param('orderId') orderId: string,
        @Param('processId') processId: string,
    ) {
        return this.service.list(orderId, processId);
    }

    @Get(':runId')
    async get(
        @Param('orderId') orderId: string,
        @Param('processId') processId: string,
        @Param('runId') runId: string,
    ) {
        return this.service.get(orderId, processId, runId);
    }
}

import {
    Body,
    Controller,
    Get,
    Param,
    Put
} from '@nestjs/common';
import { ConfigureRunDto } from './dto/configure-run.dto';
import { RunsService } from './runs.service';

@Controller('api/orders/:orderId/processes/:processId/runs')
export class RunsController {
    constructor(
        private readonly service: RunsService,
    ) { }

    //  @Post()
    //  async create(
    //    @Param('orderId') orderId: string,
    //    @Param('processId') processId: string,
    //    @Body() dto: CreateRunDto,
    //  ) {
    //    return this.service.create(orderId, processId, dto);
    //  }

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

    @Put(':runId/configure')
    async configure(
        @Param('orderId') orderId: string,
        @Param('processId') processId: string,
        @Param('runId') runId: string,
        @Body() dto: ConfigureRunDto,
    ) {
        return this.service.configure(
            orderId,
            processId,
            runId,
            dto,
        );
    }

    @Put(':runId/location')
    async updateLocation(
        @Param('orderId') orderId: string,
        @Param('processId') processId: string,
        @Param('runId') runId: string,
        @Body('location') location: string,
    ) {
        return this.service.updateLocation(
            orderId,
            processId,
            runId,
            location,
        );
    }
}

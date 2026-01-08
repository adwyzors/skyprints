import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { AdminProcessService } from './admin-process.service';
import { CreateProcessDto } from './dto/create-process.dto';

@Controller('process')
export class AdminProcessController {
    private readonly logger = new Logger(AdminProcessController.name);

    constructor(
        private readonly service: AdminProcessService,
    ) { }

    @Post()
    async create(@Body() dto: CreateProcessDto) {
        this.logger.log(`Creating process: ${dto.name}`);
        return this.service.create(dto);
    }

    @Get(':processId')
    async getById(@Param('processId') id: string) {
        this.logger.log(`Fetching process ${id}`);
        return this.service.getById(id);
    }

    @Get()
    async list() {
        this.logger.log('Fetching all processes');
        return this.service.list();
    }

    @Put(':processId/enable')
    async enable(@Param('processId') id: string) {
        this.logger.log(`Enabling process ${id}`);
        return this.service.enable(id);
    }

    @Put(':processId/disable')
    async disable(@Param('processId') id: string) {
        this.logger.log(`Disabling process ${id}`);
        return this.service.disable(id);
    }
}

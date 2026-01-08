import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { CreateRunTemplateDto } from './dto/create-run-template.dto';
import { UpdateRunTemplateDto } from './dto/update-run-template.dto';
import { RunTemplatesService } from './run-templates.service';

@Controller('/runs/templates')
export class RunTemplatesController {
    private readonly logger = new Logger(
        RunTemplatesController.name,
    );

    constructor(
        private readonly service: RunTemplatesService,
    ) { }

    @Post()
    async create(@Body() dto: CreateRunTemplateDto) {
        this.logger.log(
            `Creating RunTemplate: ${dto.name}`,
        );
        return this.service.create(dto);
    }

    @Get()
    async list() {
        return this.service.list();
    }

    @Get(':id')
    async get(@Param('id') id: string) {
        return this.service.get(id);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateRunTemplateDto,
    ) {
        return this.service.update(id, dto);
    }
}

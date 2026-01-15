import type { CreateCustomerDto, QueryCustomerDto } from '@app/contracts';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query
} from '@nestjs/common';

import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    @Post()
    create(@Body() dto: CreateCustomerDto) {
        return this.service.create(dto);
    }

    @Get()
    findAll(@Query() query: QueryCustomerDto) {
        return this.service.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Delete(':id')
    deactivate(@Param('id') id: string) {
        return this.service.deactivate(id);
    }
}

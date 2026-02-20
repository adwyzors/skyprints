import {
    BulkDeleteSchema,
    CreateCustomerSchema,
    QueryCustomerSchema,
    UpdateCustomerSchema,
} from '@app/contracts';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query
} from '@nestjs/common';

import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
    constructor(
        private readonly service: CustomersService,
    ) { }

    /* =========================
     * Create Customer
     * ========================= */
    @Post()
    create(@Body() body: unknown) {
        const dto = CreateCustomerSchema.parse(body);
        return this.service.create(dto);
    }

    /* =========================
     * Update Customer
     * ========================= */
    @Patch(':id')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: unknown,
    ) {
        const dto = UpdateCustomerSchema.parse(body);
        return this.service.update(id, dto);
    }

    /* =========================
     * List Customers
     * ========================= */
    @Get()
    findAll(@Query() query: unknown) {
        const parsedQuery = QueryCustomerSchema.parse(query);
        return this.service.findAll(parsedQuery);
    }

    /* =========================
     * Get Customer by ID
     * ========================= */
    @Get(':id')
    findOne(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.service.findOne(id);
    }

    /* =========================
     * Soft Delete Customer
     * ========================= */
    @Delete(':id')
    softDelete(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.service.softDelete(id);
    }

    /* =========================
     * Bulk Soft Delete Customers
     * ========================= */
    @Delete()
    softDeleteMany(@Body() body: unknown) {
        const dto = BulkDeleteSchema.parse(body);
        return this.service.softDeleteMany(dto.ids);
    }
}

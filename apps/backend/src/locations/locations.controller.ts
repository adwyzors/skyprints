import {
    CreateLocationSchema,
    QueryLocationSchema,
    UpdateLocationSchema,
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

import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
    constructor(
        private readonly service: LocationsService,
    ) { }

    /* =========================
     * Create Location
     * ========================= */
    @Post()
    create(@Body() body: unknown) {
        const dto = CreateLocationSchema.parse(body);
        return this.service.create(dto);
    }

    /* =========================
     * Update Location
     * ========================= */
    @Patch(':id')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() body: unknown,
    ) {
        const dto = UpdateLocationSchema.parse(body);
        return this.service.update(id, dto);
    }

    /* =========================
     * List Locations
     * ========================= */
    @Get()
    findAll(@Query() query: unknown) {
        const parsedQuery = QueryLocationSchema.parse(query);
        return this.service.findAll(parsedQuery);
    }

    /* =========================
     * Get Location by ID
     * ========================= */
    @Get(':id')
    findOne(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.service.findOne(id);
    }

    /* =========================
     * Delete Location (Soft)
     * ========================= */
    @Delete(':id')
    delete(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.service.delete(id);
    }
}

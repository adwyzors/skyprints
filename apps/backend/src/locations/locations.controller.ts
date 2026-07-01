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
  Query,
} from '@nestjs/common';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  /* =========================
   * Create Location
   * ========================= */
  @Post()
  @Permissions('locations:create')
  create(@Body() body: unknown) {
    const dto = CreateLocationSchema.parse(body);
    return this.service.create(dto);
  }

  /* =========================
   * Update Location
   * ========================= */
  @Patch(':id')
  @Permissions('locations:update')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const dto = UpdateLocationSchema.parse(body);
    return this.service.update(id, dto);
  }

  /* =========================
   * List Locations
   * ========================= */
  @Get()
  @Permissions('locations:view')
  findAll(@Query() query: unknown) {
    const parsedQuery = QueryLocationSchema.parse(query);
    return this.service.findAll(parsedQuery);
  }

  /* =========================
   * Get Location by ID
   * ========================= */
  @Get(':id')
  @Permissions('locations:view')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  /* =========================
   * Delete Location (Soft)
   * ========================= */
  @Delete(':id')
  @Permissions('locations:delete')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.delete(id);
  }
}

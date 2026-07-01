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
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as multer from 'multer';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  /* =========================
   * Export Customers to Excel
   * ========================= */
  @Get('export')
  @Permissions('customers:view')
  async exportCustomers(@Res() res: Response) {
    return this.service.exportToExcel(res);
  }

  /* =========================
   * Import Customers from Excel
   * ========================= */
  @Post('import')
  @Permissions('customers:create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    }),
  )
  async importCustomers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded.' };
    }
    return this.service.importFromExcel(file.buffer);
  }

  /* =========================
   * Create Customer
   * ========================= */
  @Post()
  @Permissions('customers:create')
  create(@Body() body: unknown) {
    const dto = CreateCustomerSchema.parse(body);
    return this.service.create(dto);
  }

  /* =========================
   * Update Customer
   * ========================= */
  @Patch(':id')
  @Permissions('customers:update')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    const dto = UpdateCustomerSchema.parse(body);
    return this.service.update(id, dto);
  }

  /* =========================
   * List Customers
   * ========================= */
  @Get()
  @Permissions('customers:view')
  findAll(@Query() query: unknown) {
    const parsedQuery = QueryCustomerSchema.parse(query);
    return this.service.findAll(parsedQuery);
  }

  /* =========================
   * Get Customer by ID
   * ========================= */
  @Get(':id')
  @Permissions('customers:view')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  /* =========================
   * Soft Delete Customer
   * ========================= */
  @Delete(':id')
  @Permissions('customers:delete')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  /* =========================
   * Bulk Soft Delete Customers
   * ========================= */
  @Delete()
  @Permissions('customers:delete')
  softDeleteMany(@Body() body: unknown) {
    const dto = BulkDeleteSchema.parse(body);
    return this.service.softDeleteMany(dto.ids);
  }
}

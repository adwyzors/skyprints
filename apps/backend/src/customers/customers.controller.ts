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

import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  /* =========================
   * Export Customers to Excel
   * ========================= */
  @Get('export')
  async exportCustomers(@Res() res: Response) {
    return this.service.exportToExcel(res);
  }

  /* =========================
   * Import Customers from Excel
   * ========================= */
  @Post('import')
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
  create(@Body() body: unknown) {
    const dto = CreateCustomerSchema.parse(body);
    return this.service.create(dto);
  }

  /* =========================
   * Update Customer
   * ========================= */
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
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
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  /* =========================
   * Soft Delete Customer
   * ========================= */
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
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

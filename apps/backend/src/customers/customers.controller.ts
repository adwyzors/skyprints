import {
  CreateCustomerSchema,
  QueryCustomerSchema,
} from '@app/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
  ) {}

  /* =========================
   * Create Customer
   * ========================= */
  @Post()
  create(@Body() body: unknown) {
    const dto = CreateCustomerSchema.parse(body);
    return this.service.create(dto);
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
}

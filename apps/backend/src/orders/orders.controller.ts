/// <reference types="multer" />
import type { CreateOrderDto, UpdateOrderDto } from '@app/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CloudflareService } from '../common/cloudflare.service';
import { RequestContextStore } from '../common/context/request-context.store';
import { ContextLogger } from '../common/logger/context.logger';
import { OrdersQueryDto } from '../dto/orders.query.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  private readonly logger = new ContextLogger(OrdersController.name);

  constructor(
    private readonly service: OrdersService,
    private readonly cloudflare: CloudflareService,
  ) {}

  @Get('upload-url')
  @Permissions('orders:create')
  async getUploadUrl(
    @Query('filename') filename: string,
    @Query('folder') folder: string = 'orders',
  ) {
    if (!filename) {
      throw new BadRequestException('Filename is required');
    }
    return this.cloudflare.getPresignedUrl(folder, filename);
  }

  @Get('cards')
  @Permissions('orders:view')
  async getOrderCards(@Query() query: OrdersQueryDto) {
    return this.service.getOrderCards(query);
  }

  @Post(':id/reorder')
  @Permissions('orders:reorder')
  async reorder(@Param('id') orderId: string) {
    const ctx = RequestContextStore.getStore();
    this.logger.log(
      `[REORDER] cid=${ctx?.correlationId} sourceOrder=${orderId}`,
    );

    return this.service.reorder(orderId);
  }

  @Post(':orderId/processes')
  @Permissions('orders:update')
  addProcessToOrder(
    @Param('orderId') orderId: string,
    @Body() dto: { processId: string; count: number },
  ) {
    return this.service.addProcessToOrder(orderId, dto);
  }

  @Delete(':orderId/processes/:processId')
  @Permissions('orders:update')
  deleteProcessFromOrder(
    @Param('orderId') orderId: string,
    @Param('processId') processId: string,
  ) {
    return this.service.deleteProcessFromOrder(orderId, processId);
  }

  @Post(':orderId/processes/:processId/runs')
  @Permissions('runs:create')
  addRunToProcess(
    @Param('orderId') orderId: string,
    @Param('processId') processId: string,
    @Body() dto: { count?: number } = {},
  ) {
    return this.service.addRunToProcess(orderId, processId, dto.count);
  }

  @Delete(':orderId/processes/:processId/runs/:runId')
  @Permissions('runs:delete')
  deleteRun(
    @Param('orderId') orderId: string,
    @Param('processId') processId: string,
    @Param('runId') runId: string,
  ) {
    return this.service.deleteRunFromProcess(orderId, processId, runId);
  }

  @Patch(':orderId')
  @Permissions('orders:update')
  updateOrder(@Param('orderId') orderId: string, @Body() dto: UpdateOrderDto) {
    return this.service.updateBasicDetails(orderId, dto);
  }

  @Get()
  @Permissions('orders:view')
  async getAll(@Query() query: OrdersQueryDto) {
    return this.service.getAll(query);
  }

  @Post()
  @Permissions('orders:create')
  async create(@Body() dto: CreateOrderDto) {
    const ctx = RequestContextStore.getStore();

    if (typeof dto.processes === 'string') {
      try {
        dto.processes = JSON.parse(dto.processes);
      } catch {
        throw new BadRequestException('Invalid JSON in processes');
      }
    }

    if (typeof dto.quantity === 'string') {
      const qty = Number(dto.quantity);
      if (Number.isNaN(qty)) {
        throw new BadRequestException('Invalid quantity');
      }
      dto.quantity = qty;
    }

    this.logger.log(
      `[CREATE_ORDER] cid=${ctx?.correlationId} customerId=${dto.customerId} images=${dto?.images?.length ?? 0}`,
    );

    return this.service.create(dto);
  }

  @Get(':id')
  @Permissions('orders:view')
  async get(@Param('id') orderId: string) {
    return this.service.getById(orderId);
  }

  @Post(':id/production-ready')
  @Permissions('orders:update')
  async setProductionReady(@Param('id') orderId: string) {
    return this.service.setProductionReady(orderId);
  }

  @Post(':id/start-production')
  @Permissions('orders:start-production')
  async startProduction(@Param('id') orderId: string) {
    return this.service.startProduction(orderId);
  }

  @Post(':id/complete-production')
  @Permissions('orders:update')
  async completeProduction(@Param('id') orderId: string) {
    return this.service.completeProduction(orderId);
  }

  @Delete(':id')
  @Permissions('orders:delete')
  async delete(@Param('id') orderId: string) {
    return this.service.delete(orderId);
  }

  @Post('bulk-delete')
  @Permissions('orders:delete')
  async deleteBulk(@Body() body: { ids: string[] }) {
    if (!body.ids || !Array.isArray(body.ids)) {
      throw new BadRequestException('Invalid ids array');
    }
    return this.service.deleteBulk(body.ids);
  }
}

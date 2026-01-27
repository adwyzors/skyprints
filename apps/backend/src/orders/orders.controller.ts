/// <reference types="multer" />
import type { CreateOrderDto } from '@app/contracts';
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
    ) { }

    @Get('upload-url')
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
    async getOrderCards(@Query() query: OrdersQueryDto) {
        return this.service.getOrderCards(query);
    }

    @Get()
    async getAll(@Query() query: OrdersQueryDto) {
        return this.service.getAll(query);
    }

    @Post()
    @UseInterceptors(
        FilesInterceptor('images', 5, {
            limits: { fileSize: 3 * 1024 * 1024 },
        }),
    )
    async create(
        @Body() dto: CreateOrderDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
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
            `[CREATE_ORDER] cid=${ctx?.correlationId} customerId=${dto.customerId} images=${files?.length ?? 0}`,
        );

        return this.service.createWithImages(dto, files ?? []);
    }


    @Get(':id')
    async get(@Param('id') orderId: string) {
        return this.service.getById(orderId);
    }

    @Post(':id/production-ready')
    async setProductionReady(@Param('id') orderId: string) {
        return this.service.setProductionReady(orderId);
    }
}

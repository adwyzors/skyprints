/// <reference types="multer" />
import type { CreateOrderDto } from '@app/contracts';
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OrdersQueryDto } from '../dto/orders.query.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
    private readonly logger = new Logger(OrdersController.name);

    constructor(private readonly service: OrdersService) { }

    @Get()
    async getAll(@Query() query: OrdersQueryDto) {
        return this.service.getAll(query);
    }

    @Post()
    async create(@Body() dto: CreateOrderDto) {
        this.logger.log(`Creating order for customerId=${dto.customerId}`);
        return this.service.create(dto);
    }

    @Get(':id')
    async get(@Param('id') orderId: string) {
        return this.service.getById(orderId);
    }

    @Post(':id/images')
    @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 images
    async uploadImages(
        @Param('id') orderId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No images provided');
        }

        this.logger.log(`Uploading ${files.length} images for order ${orderId}`);
        return this.service.uploadImages(orderId, files);
    }
}

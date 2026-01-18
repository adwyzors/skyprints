import type { CreateOrderDto } from '@app/contracts';
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersQueryDto } from '../dto/orders.query.dto';

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
}

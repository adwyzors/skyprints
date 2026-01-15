import type { CreateOrderDto } from '@app/contracts';
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post
} from '@nestjs/common';
import { OrdersService } from './orders.service';


@Controller('orders')
export class OrdersController {
    private readonly logger = new Logger(OrdersController.name);

    constructor(
        private readonly service: OrdersService,
    ) { }

    @Get()
    async getAll() {
        return this.service.getAll();
    }

    @Post()
    async create(@Body() dto: CreateOrderDto) {
        this.logger.log(
            `Creating order for ${dto.customerId}`,
        );
        return this.service.create(dto);
    }

    @Get(':id')
    async get(@Param('id') orderId: string) {
        return this.service.getById(orderId);
    }

}

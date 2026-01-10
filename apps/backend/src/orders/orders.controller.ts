import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
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

    @Get(':orderId')
    async get(@Param('orderId') id: string) {
        return this.service.getById(id);
    }
}

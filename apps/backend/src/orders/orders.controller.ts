import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Logger,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

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
            `Creating order for ${dto.customerName}`,
        );
        return this.service.create(dto);
    }

    @Get(':orderId')
    async get(@Param('orderId') id: string) {
        return this.service.getById(id);
    }
}

import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OutboxModule } from "../outbox/outbox.module";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService],
    imports: [OutboxModule],

})
export class OrdersModule { }

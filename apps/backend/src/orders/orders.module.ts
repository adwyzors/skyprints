import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService],
    imports: [OutboxModule],
    exports: [OrdersService],

})
export class OrdersModule { }

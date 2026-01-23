import { Module } from "@nestjs/common";
import { CloudflareService } from "../common/cloudflare.service";
import { OutboxModule } from "../outbox/outbox.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService, CloudflareService],
    imports: [OutboxModule],
    exports: [OrdersService],

})
export class OrdersModule { }

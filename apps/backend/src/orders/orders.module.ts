import { Module } from "@nestjs/common";
import { CloudflareService } from "../common/cloudflare.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService, CloudflareService],
    exports: [OrdersService],

})
export class OrdersModule { }

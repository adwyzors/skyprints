import { Module } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { OutboxModule } from "src/outbox/outbox.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService],
    imports: [OutboxModule],

})
export class OrdersModule { }

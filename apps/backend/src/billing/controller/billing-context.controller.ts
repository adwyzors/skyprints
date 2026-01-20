import type { AddOrdersToBillingContextDto, CreateBillingContextDto } from "@app/contracts";
import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import { BillingContextService } from "../services/billing-context.service";

@Controller("billing/contexts")
export class BillingContextController {
    constructor(private readonly service: BillingContextService) { }

    @Post()
    create(@Body() dto: CreateBillingContextDto) {
        return this.service.create(dto);
    }

    @Post(":contextId/orders")
    addOrders(
        @Param("contextId") contextId: string,
        @Body() dto: AddOrdersToBillingContextDto
    ) {
        return this.service.addOrders(
            contextId,
            dto.orderIds
        );
    }

    @Post(":contextId/orders/:orderId")
    addOrder(
        @Param("contextId") contextId: string,
        @Param("orderId") orderId: string
    ) {
        return this.service.addOrders(
            contextId,
            [orderId]
        );
    }

    @Delete(":contextId/orders/:orderId")
    removeOrder(
        @Param("contextId") contextId: string,
        @Param("orderId") orderId: string
    ) {
        return this.service.removeOrder(contextId, orderId);
    }
}

import type { AddOrdersToBillingContextDto, CreateBillingContextDto } from "@app/contracts";
import { Body, Controller, Delete, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
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

    @Get()
    async getAll(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('search') search?: string,
        @Res({ passthrough: true }) res?: Response
    ) {
        const result = await this.service.getAllContexts(
            page ? Number(page) : 1,
            limit ? Number(limit) : 12,
            search || ""
        );

        // Set pagination metadata in headers
        if (res) {
            res.setHeader('x-page', result.meta.page.toString());
            res.setHeader('x-limit', result.meta.limit.toString());
            res.setHeader('x-total', result.meta.total.toString());
            res.setHeader('x-total-pages', result.meta.totalPages.toString());
        }

        // Return only the data
        return result.res;
    }

    @Get(":contextId")
    getById(@Param("contextId") contextId: string) {
        return this.service.getContextById(contextId);
    }
}

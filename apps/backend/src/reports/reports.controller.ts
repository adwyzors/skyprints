import { Controller, Get, Query, Res } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsQueryDto } from "./dto/reports.query.dto";
import { Response } from "express";

@Controller("reports")
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get("billed-orders")
    async getBilledOrders(@Query() query: ReportsQueryDto) {
        return this.reportsService.getBilledOrdersReport(query);
    }

    @Get("billed-orders/export")
    async exportBilledOrders(
        @Query() query: ReportsQueryDto,
        @Res() res: Response
    ) {
        return this.reportsService.exportBilledOrdersToExcel(query, res);
    }
}

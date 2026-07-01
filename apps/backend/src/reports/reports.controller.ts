import { Controller, Get, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsQueryDto } from './dto/reports.query.dto';
import { Response } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('billed-orders')
  @Permissions('analytics:view')
  async getBilledOrders(
    @Query() query: ReportsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.getBilledOrdersReport(query);

    if (result.meta) {
      res.setHeader('x-total-count', String(result.meta.total));
      res.setHeader('x-page', String(result.meta.page));
      res.setHeader('x-limit', String(result.meta.limit));
      res.setHeader('x-total-pages', String(result.meta.totalPages));
      res.setHeader(
        'x-total-estimated-amount',
        String(result.meta.totalAmount),
      );
      res.setHeader('x-total-quantity', String(result.meta.totalQty));
    }

    return result.data;
  }

  @Get('billed-orders/export')
  @Permissions('analytics:view')
  async exportBilledOrders(
    @Query() query: ReportsQueryDto,
    @Res() res: Response,
  ) {
    return this.reportsService.exportBilledOrdersToExcel(query, res);
  }
}

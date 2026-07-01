import { Controller, Get, Post, Query } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics:view')
  getDashboardStats(
    @Query('period') period: string = '7d',
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getDashboardStats(
      period,
      locationId,
      startDate,
      endDate,
    );
  }

  @Post('sync')
  @Permissions('analytics:sync')
  syncData() {
    return this.analyticsService.syncExistingData();
  }

  @Get('resources')
  @Permissions('analytics:view')
  async getResourceUtilization() {
    // Return metrics specifically for manager utilization
    return this.analyticsService.getDashboardStats(); // Expand later
  }
}

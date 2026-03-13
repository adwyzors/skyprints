import { Controller, Get, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('dashboard')
    getDashboardStats(
        @Query('period') period: string = '7d',
        @Query('locationId') locationId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.analyticsService.getDashboardStats(period, locationId, startDate, endDate);
    }

    @Post('sync')
    syncData() {
        return this.analyticsService.syncExistingData();
    }

    @Get('resources')
    async getResourceUtilization() {
        // Return metrics specifically for manager utilization
        return this.analyticsService.getDashboardStats(); // Expand later
    }
}

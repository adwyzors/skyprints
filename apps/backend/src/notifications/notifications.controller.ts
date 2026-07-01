import { Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.service.getNotifications(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.id;
    return this.service.getUnreadCount(userId);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.id;
    return this.service.markAllAsRead(userId);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.service.markAsRead(id, userId);
  }
}

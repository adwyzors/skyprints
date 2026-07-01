import { Controller, Get, Post, Param, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const userId = req.user.id;
    return this.service.getNotifications(userId);
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

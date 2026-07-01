import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';

@Injectable()
export class NotificationsService {
  private readonly logger = new ContextLogger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(orderId: string, orderCode: string, message: string, tx?: any) {
    const client = tx || this.prisma;
    try {
      const notif = await client.notification.create({
        data: {
          orderId,
          orderCode,
          message,
        },
      });
      this.logger.log(`Notification created for order ${orderCode}: ${notif.id}`);
      return notif;
    } catch (err) {
      this.logger.error(`Failed to create notification for order ${orderCode}: ${err.message}`);
    }
  }

  async getNotifications(userId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!dbUser || !(dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN')) {
      throw new ForbiddenException('Only admin accounts can access notifications');
    }

    // Retrieve last 50 notifications
    const list = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return list.map((n) => ({
      id: n.id,
      orderId: n.orderId,
      orderCode: n.orderCode,
      message: n.message,
      createdAt: n.createdAt,
      isRead: n.readByUserIds.includes(userId),
    }));
  }

  async markAsRead(notificationId: string, userId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (n && !n.readByUserIds.includes(userId)) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          readByUserIds: {
            set: [...n.readByUserIds, userId],
          },
        },
      });
    }
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.client.$executeRaw`
      UPDATE "Notification"
      SET "readByUserIds" = array_append("readByUserIds", ${userId})
      WHERE NOT (${userId} = ANY("readByUserIds"))
    `;
    return { success: true };
  }
}

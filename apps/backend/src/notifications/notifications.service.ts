import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';

@Injectable()
export class NotificationsService {
  private readonly logger = new ContextLogger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    orderId: string,
    orderCode: string,
    message: string,
    tx?: any,
  ) {
    const client = tx || this.prisma;
    try {
      const notif = await client.notification.create({
        data: {
          orderId,
          orderCode,
          message,
        },
      });
      this.logger.log(
        `Notification created for order ${orderCode}: ${notif.id}`,
      );

      // Prune old notifications asynchronously
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      client.notification
        .deleteMany({
          where: {
            createdAt: {
              lt: thirtyDaysAgo,
            },
          },
        })
        .catch((err: any) => {
          this.logger.error(
            `Failed to prune old notifications: ${err.message}`,
          );
        });

      return notif;
    } catch (err) {
      this.logger.error(
        `Failed to create notification for order ${orderCode}: ${err.message}`,
      );
    }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (
      !dbUser ||
      !(dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only admin accounts can access notifications',
      );
    }
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    await this.assertAdmin(userId);

    const count = await this.prisma.notification.count({
      where: { NOT: { readByUserIds: { has: userId } } },
    });

    return { count };
  }

  async getNotifications(userId: string, page = 1, limit = 10) {
    await this.assertAdmin(userId);

    const skip = (page - 1) * limit;

    const [total, list] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              statusCode: true,
            },
          },
        },
      }),
    ]);

    return {
      data: list.map((n) => ({
        id: n.id,
        orderId: n.orderId,
        orderCode: n.orderCode,
        message: n.message,
        createdAt: n.createdAt,
        isRead: n.readByUserIds.includes(userId),
        orderStatus: n.order?.statusCode,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
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
        AND "createdAt" > NOW() - INTERVAL '30 days'
    `;
    return { success: true };
  }
}

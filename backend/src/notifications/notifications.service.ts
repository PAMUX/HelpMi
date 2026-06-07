import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
import { PUSH_PROVIDER, type PushProvider } from './providers/push.provider.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(
    private prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private push: PushProvider,
  ) {}

  async getForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount: count };
  }

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    taskId?: string,
    data?: object,
  ) {
    try {
      const notification = await this.prisma.notification.create({
        data: { userId, type, title, body, taskId, data: data as object },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      if (user?.fcmToken) {
        await this.push.sendToToken(user.fcmToken, {
          title,
          body,
          data: { type, ...(taskId ? { taskId } : {}) },
        });
      }

      return notification;
    } catch (err) {
      this.logger.error(`Failed to send notification to ${userId}: ${(err as Error).message}`);
      return null;
    }
  }

  async sendToMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    taskId?: string,
    data?: object,
  ) {
    await Promise.all(userIds.map((id) => this.send(id, type, title, body, taskId, data)));
  }
}

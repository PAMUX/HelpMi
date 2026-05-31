import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, taskId, data },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      // TODO: Replace with actual FCM HTTP v1 API call
      console.log(`[FCM] → ${user.fcmToken}: ${title} — ${body}`);
    }

    return notification;
  }
}

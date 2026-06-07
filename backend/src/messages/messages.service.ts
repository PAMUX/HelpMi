import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async getMessages(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== userId && task.doerId !== userId) {
      throw new ForbiddenException('Not a participant of this task');
    }

    await this.prisma.message.updateMany({
      where: { taskId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    return this.prisma.message.findMany({
      where: { taskId },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(taskId: string, senderId: string, dto: SendMessageDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== senderId && task.doerId !== senderId) {
      throw new ForbiddenException('Not a participant of this task');
    }
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new ForbiddenException('Cannot send messages on a closed task');
    }

    const message = await this.prisma.message.create({
      data: {
        taskId,
        senderId,
        content: dto.content,
        type: dto.type ?? 'TEXT',
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const recipientId = task.posterId === senderId ? task.doerId : task.posterId;
    if (recipientId) {
      this.events.emit(NotificationEvent.MESSAGE_SENT, {
        taskId,
        senderId,
        recipientId,
        preview: dto.content.slice(0, 80),
      });
    }

    return message;
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        task: {
          OR: [{ posterId: userId }, { doerId: userId }],
        },
      },
    });
    return { unreadCount: count };
  }
}

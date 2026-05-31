import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.message.create({
      data: {
        taskId,
        senderId,
        content: dto.content,
        type: dto.type ?? 'TEXT',
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
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

import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';

@Injectable()
export class RatingsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async create(raterId: string, dto: CreateRatingDto) {
    const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'COMPLETED') {
      throw new BadRequestException('Can only rate completed tasks');
    }

    const isPoster = task.posterId === raterId;
    const isDoer = task.doerId === raterId;
    if (!isPoster && !isDoer) {
      throw new ForbiddenException('Not a participant of this task');
    }

    const rateeId = isPoster ? task.doerId! : task.posterId;
    if (!rateeId) throw new BadRequestException('No doer assigned to this task');

    const existing = await this.prisma.rating.findUnique({
      where: { taskId_raterId: { taskId: dto.taskId, raterId } },
    });
    if (existing) throw new BadRequestException('Already rated this task');

    const rating = await this.prisma.rating.create({
      data: {
        taskId: dto.taskId,
        raterId,
        rateeId,
        score: dto.score,
        comment: dto.comment,
        isOnTime: dto.isOnTime,
      },
    });

    await this.updateDoerStats(rateeId);

    this.events.emit(NotificationEvent.RATING_RECEIVED, {
      rateeId,
      raterId,
      taskId: dto.taskId,
      score: dto.score,
    });

    return rating;
  }

  async getForUser(userId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { rateeId: userId },
      include: {
        rater: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { title: true, category: { select: { nameEn: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;
    const onTimeCount = ratings.filter((r) => r.isOnTime).length;

    return {
      ratings,
      summary: {
        total: ratings.length,
        average: +avg.toFixed(1),
        onTimeRate: ratings.length ? +(onTimeCount / ratings.length).toFixed(2) : 0,
      },
    };
  }

  private async updateDoerStats(userId: string) {
    const profile = await this.prisma.doerProfile.findUnique({ where: { userId } });
    if (!profile) return;

    const ratings = await this.prisma.rating.findMany({ where: { rateeId: userId } });
    if (!ratings.length) return;

    const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
    const onTimeCount = ratings.filter((r) => r.isOnTime === true).length;
    const onTimeRated = ratings.filter((r) => r.isOnTime !== null).length;

    await this.prisma.doerProfile.update({
      where: { userId },
      data: {
        avgRating: +avg.toFixed(2),
        onTimeRate: onTimeRated ? +(onTimeCount / onTimeRated).toFixed(2) : 0,
      },
    });
  }
}

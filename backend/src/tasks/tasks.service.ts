import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DoerTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { NearbyTasksDto } from './dto/nearby-tasks.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';

const TIER_RANK: Record<DoerTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2 };

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(posterId: string, dto: CreateTaskDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const task = await this.prisma.task.create({
      data: {
        posterId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        photoUrls: dto.photoUrls ?? [],
        locationLat: dto.locationLat,
        locationLng: dto.locationLng,
        locationAddress: dto.locationAddress,
        budget: dto.budget,
        paymentMode: dto.paymentMode ?? 'ESCROW',
        requiredTier: dto.requiredTier ?? category.minTier,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
      },
      include: { category: true },
    });

    if (task.paymentMode === 'ESCROW') {
      const budget = Number(task.budget);
      await this.prisma.escrow.create({
        data: {
          taskId: task.id,
          posterId,
          taskBudget: budget,
          platformFeeFromPoster: +(budget * 0.05).toFixed(2),
          platformFeeFromDoer: +(budget * 0.15).toFixed(2),
          trustFundReserve: +(budget * 0.05).toFixed(2),
          netDoerPayout: +(budget * 0.85).toFixed(2),
          status: 'PENDING',
        },
      });
    }

    return task;
  }

  async findNearby(dto: NearbyTasksDto, userId: string) {
    const doerProfile = await this.prisma.doerProfile.findUnique({ where: { userId } });
    const doerTier: DoerTier = doerProfile?.kycStatus === 'APPROVED' ? doerProfile.tier : 'BRONZE';

    const eligibleTiers = this.tiersUpTo(doerTier);
    const radiusKm = dto.radiusKm ?? 10;
    const limit = dto.limit ?? 50;

    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'OPEN',
        requiredTier: { in: eligibleTiers },
        posterId: { not: userId },
      },
      include: {
        category: true,
        poster: { select: { id: true, name: true, avatarUrl: true } },
        escrow: { select: { status: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: limit * 3,
    });

    return tasks
      .map((t) => ({
        ...t,
        distance: this.haversine(dto.lat, dto.lng, t.locationLat, t.locationLng),
      }))
      .filter((t) => t.distance <= radiusKm)
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.distance - b.distance;
      })
      .slice(0, limit);
  }

  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        category: true,
        poster: { select: { id: true, name: true, avatarUrl: true } },
        doer: { select: { id: true, name: true, avatarUrl: true } },
        escrow: true,
        dispute: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getAcceptedTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { doerId: userId },
      include: {
        category: true,
        poster: { select: { id: true, name: true, avatarUrl: true } },
        escrow: { select: { status: true, netDoerPayout: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPostedTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { posterId: userId },
      include: {
        category: true,
        doer: { select: { id: true, name: true, avatarUrl: true } },
        escrow: { select: { status: true, netDoerPayout: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(taskId: string, doerId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'OPEN') throw new BadRequestException('Task is no longer available');
    if (task.posterId === doerId) throw new ForbiddenException('Cannot accept your own task');

    const doerProfile = await this.prisma.doerProfile.findUnique({ where: { userId: doerId } });
    if (!doerProfile || doerProfile.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Complete KYC verification before accepting tasks');
    }
    if (TIER_RANK[doerProfile.tier] < TIER_RANK[task.requiredTier]) {
      throw new ForbiddenException(
        `This task requires ${task.requiredTier} tier. Your tier is ${doerProfile.tier}.`,
      );
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'ASSIGNED', doerId, acceptedAt: new Date() },
      include: { poster: { select: { id: true, name: true, phone: true } } },
    });
  }

  async markStarted(taskId: string, doerId: string) {
    const task = await this.ensureTaskDoer(taskId, doerId);
    if (task.status !== 'ASSIGNED') {
      throw new BadRequestException('Task must be in ASSIGNED state to start');
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async markComplete(taskId: string, doerId: string, dto: CompleteTaskDto) {
    const task = await this.ensureTaskDoer(taskId, doerId);
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(task.status)) {
      throw new BadRequestException('Task cannot be marked complete in its current state');
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionPhotoUrl: dto.completionPhotoUrl,
      },
    });
  }

  async confirm(taskId: string, posterId: string) {
    const task = await this.ensureTaskPoster(taskId, posterId);
    if (task.status !== 'COMPLETED') {
      throw new BadRequestException('Task must be marked complete by doer first');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { confirmedAt: new Date() },
    });

    if (task.paymentMode === 'ESCROW') {
      await this.prisma.escrow.update({
        where: { taskId },
        data: { status: 'RELEASED', releasedAt: new Date(), doerId: task.doerId },
      });

      if (task.doerId) {
        await this.prisma.doerProfile.update({
          where: { userId: task.doerId },
          data: { totalJobsCompleted: { increment: 1 } },
        });
      }
    }

    return updated;
  }

  async cancel(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const isPoster = task.posterId === userId;
    const isDoer = task.doerId === userId;
    if (!isPoster && !isDoer) throw new ForbiddenException('Not authorized');

    if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(task.status)) {
      throw new BadRequestException('Task cannot be cancelled in its current state');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
    });

    if (task.paymentMode === 'ESCROW') {
      const escrow = await this.prisma.escrow.findUnique({ where: { taskId } });
      if (escrow && escrow.status === 'HELD') {
        await this.prisma.escrow.update({
          where: { taskId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }
    }

    return updated;
  }

  async raiseDispute(taskId: string, userId: string, reason: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== userId && task.doerId !== userId) {
      throw new ForbiddenException('Not a participant of this task');
    }
    if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(task.status)) {
      throw new BadRequestException('Cannot raise dispute for this task status');
    }

    const [updatedTask] = await this.prisma.$transaction([
      this.prisma.task.update({ where: { id: taskId }, data: { status: 'DISPUTED' } }),
      this.prisma.dispute.create({ data: { taskId, raisedById: userId, reason } }),
      ...(task.paymentMode === 'ESCROW'
        ? [this.prisma.escrow.update({ where: { taskId }, data: { status: 'DISPUTED' } })]
        : []),
    ]);

    return updatedTask;
  }

  private async ensureTaskDoer(taskId: string, doerId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.doerId !== doerId) throw new ForbiddenException('Not the assigned doer');
    return task;
  }

  private async ensureTaskPoster(taskId: string, posterId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== posterId) throw new ForbiddenException('Not the task poster');
    return task;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private tiersUpTo(tier: DoerTier): DoerTier[] {
    if (tier === 'GOLD') return ['BRONZE', 'SILVER', 'GOLD'];
    if (tier === 'SILVER') return ['BRONZE', 'SILVER'];
    return ['BRONZE'];
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DoerTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { NearbyTasksDto } from './dto/nearby-tasks.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';
import { PayoutService } from '../payments/payout.service.js';
import { RefundService } from '../payments/refund.service.js';

const TIER_RANK: Record<DoerTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2 };

// G-2: the only states a task can be cancelled from (allowlist == CAS guard).
const CANCELLABLE_STATUSES = ['PENDING_PAYMENT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS'] as const;

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private payouts: PayoutService,
    private refunds: RefundService,
  ) {}

  async create(posterId: string, dto: CreateTaskDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const paymentMode = dto.paymentMode ?? 'ESCROW';
    // P3-B: CASH tasks now also start PENDING_PAYMENT until the Rs. 99 posting
    // fee is paid; they are announced from the payment webhook (like escrow).
    const initialStatus = 'PENDING_PAYMENT';

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
        paymentMode,
        status: initialStatus,
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
    } else {
      // P3-B: create the Rs. 99 posting-fee record; task opens once it is paid.
      await this.prisma.postingFee.create({
        data: { taskId: task.id, posterId, status: 'PENDING' },
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

  /**
   * P3-C: participant-aware task detail. Poster/doer get the full record
   * (incl. escrow, dispute, counterpart phone); everyone else gets a public
   * subset with no financial or contact details.
   */
  async findById(id: string, requesterId?: string) {
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

    const isParticipant =
      !!requesterId && (task.posterId === requesterId || task.doerId === requesterId);
    if (isParticipant) return task;

    // Public view: strip escrow, dispute and doer identity.
    const { escrow, dispute, doer, doerId, ...pub } = task;
    void escrow;
    void dispute;
    void doer;
    void doerId;
    return pub;
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

    if (task.paymentMode === 'ESCROW') {
      const escrow = await this.prisma.escrow.findUnique({ where: { taskId } });
      if (!escrow || escrow.status !== 'HELD') {
        throw new BadRequestException('Funds are not yet secured for this task');
      }
    }

    // G-5: compare-and-swap assignment. The conditional WHERE is the single
    // authority on who wins; the checks above are fast-fail UX only. Two
    // concurrent accepts can both pass those checks, but only one update can
    // match { status: OPEN, doerId: null } — the loser gets a clean 400 and
    // no TASK_ACCEPTED event (same pattern as releaseEscrow's CAS).
    const result = await this.prisma.task.updateMany({
      where: { id: taskId, status: 'OPEN', doerId: null },
      data: { status: 'ASSIGNED', doerId, acceptedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('Task is no longer available');
    }

    // P3-C: do not leak the poster's phone number to the doer.
    const updated = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { poster: { select: { id: true, name: true, avatarUrl: true } } },
    });

    this.events.emit(NotificationEvent.TASK_ACCEPTED, {
      taskId,
      posterId: task.posterId,
      doerId,
      title: task.title,
    });

    return updated;
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
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionPhotoUrl: dto.completionPhotoUrl,
      },
    });

    this.events.emit(NotificationEvent.TASK_COMPLETED, {
      taskId,
      posterId: task.posterId,
      doerId,
      title: task.title,
    });

    return updated;
  }

  async confirm(taskId: string, posterId: string) {
    const task = await this.ensureTaskPoster(taskId, posterId);
    if (task.status !== 'COMPLETED') {
      throw new BadRequestException('Task must be marked complete by doer first');
    }

    if (task.paymentMode === 'ESCROW') {
      const escrow = await this.prisma.escrow.findUnique({ where: { taskId } });
      if (!escrow || escrow.status !== 'HELD') {
        throw new BadRequestException(
          'Escrow funds are not held for this task; payment cannot be released',
        );
      }
      await this.releaseEscrow(taskId, task.doerId, { markConfirmed: true });
      this.events.emit(NotificationEvent.TASK_CONFIRMED, {
        taskId,
        posterId: task.posterId,
        doerId: task.doerId,
        title: task.title,
      });
      return this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { confirmedAt: new Date() },
    });
    this.events.emit(NotificationEvent.TASK_CONFIRMED, {
      taskId,
      posterId: task.posterId,
      doerId: task.doerId,
      title: task.title,
    });
    return updated;
  }

  async releaseEscrow(
    taskId: string,
    doerId: string | null,
    opts: { markConfirmed?: boolean; auto?: boolean } = {},
  ): Promise<boolean> {
    const released = await this.prisma.$transaction(async (tx) => {
      const result = await tx.escrow.updateMany({
        where: { taskId, status: 'HELD' },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          ...(doerId ? { doerId } : {}),
        },
      });

      const didRelease = result.count === 1;

      if (didRelease && doerId) {
        await tx.doerProfile.updateMany({
          where: { userId: doerId },
          data: { totalJobsCompleted: { increment: 1 } },
        });
      }

      if (opts.markConfirmed) {
        await tx.task.update({
          where: { id: taskId },
          data: { confirmedAt: new Date() },
        });
      }

      return didRelease;
    });

    if (released) {
      const escrow = await this.prisma.escrow.findUnique({
        where: { taskId },
        select: { id: true, netDoerPayout: true },
      });

      // P3-A: exactly one payout per release (escrowId-unique guarantees it).
      if (escrow && doerId) {
        try {
          await this.payouts.createForEscrowRelease({
            escrowId: escrow.id,
            taskId,
            doerId,
            amount: Number(escrow.netDoerPayout ?? 0),
          });
        } catch {
          // Payout creation failure must not undo a completed release; the
          // ledger reconciliation/admin can recover it.
        }
      }

      this.events.emit(NotificationEvent.PAYMENT_RELEASED, {
        taskId,
        doerId,
        amount: Number(escrow?.netDoerPayout ?? 0),
        auto: !!opts.auto,
      });
    }

    return released;
  }

  async cancel(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const isPoster = task.posterId === userId;
    const isDoer = task.doerId === userId;
    if (!isPoster && !isDoer) throw new ForbiddenException('Not authorized');

    return this.executeCancel(task, userId);
  }

  /** G-2: admin recovery — force-cancel any non-terminal task (audit C-3). */
  async forceCancel(taskId: string, adminPhone: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.executeCancel(task, `admin:${adminPhone}`);
  }

  /**
   * G-2: transactional cancel. Task CANCELLED (CAS) and HELD escrow →
   * REFUND_PENDING commit atomically, so a crash can no longer strand a
   * CANCELLED task with HELD money. The actual provider refund (G-1) runs
   * post-commit; if it fails, the escrow is already REFUND_PENDING and the
   * hourly reconcile sweep retries it. Write order (task, then escrow)
   * matches the webhook transaction — no lock-order inversion.
   */
  private async executeCancel(
    task: { id: string; status: string; posterId: string; doerId: string | null; paymentMode: string; title: string },
    byUserId: string,
  ) {
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(task.status)) {
      throw new BadRequestException('Task cannot be cancelled in its current state');
    }

    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.task.updateMany({
        where: { id: task.id, status: { in: [...CANCELLABLE_STATUSES] } },
        data: { status: 'CANCELLED' },
      });
      if (cancelled.count === 0) {
        // Lost a race (double-cancel, or the webhook promoted/another actor
        // finished the task first) — bail out without touching money.
        throw new BadRequestException('Task cannot be cancelled in its current state');
      }
      if (task.paymentMode === 'ESCROW') {
        await tx.escrow.updateMany({
          where: { taskId: task.id, status: 'HELD' },
          data: { status: 'REFUND_PENDING' },
        });
      }
    });

    // G-1: auto-refund (approved decision #1). PENDING escrows hold no money,
    // so only a REFUND_PENDING claim triggers the provider call.
    if (task.paymentMode === 'ESCROW') {
      const escrow = await this.prisma.escrow.findUnique({ where: { taskId: task.id } });
      if (escrow && escrow.status === 'REFUND_PENDING') {
        try {
          await this.refunds.initiateForEscrow({
            escrowId: escrow.id,
            taskId: task.id,
            reason: 'CANCEL',
            initiatedBy: byUserId,
          });
        } catch {
          // Never undo a committed cancel; the reconcile sweep retries.
        }
      }
    }

    this.events.emit(NotificationEvent.TASK_CANCELLED, {
      taskId: task.id,
      posterId: task.posterId,
      doerId: task.doerId,
      byUserId,
      title: task.title,
    });

    return this.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
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

    this.events.emit(NotificationEvent.TASK_DISPUTED, {
      taskId,
      posterId: task.posterId,
      doerId: task.doerId,
      byUserId: userId,
      title: task.title,
    });

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

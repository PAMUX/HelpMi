import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';
import { PayoutService } from '../payments/payout.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { ANY_KYC_KEY_PATTERN } from '../uploads/upload-purpose.js';
// G-1/G-2: refund tooling + task recovery.
import { RefundService } from '../payments/refund.service.js';
import { TasksService } from '../tasks/tasks.service.js';

type PayoutStatusFilter = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
type RefundStatusFilter = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type TaskStatusFilter =
  | 'PENDING_PAYMENT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface KycDocumentView {
  /** Stored value (storage key; legacy rows may hold an opaque URL). */
  key: string;
  /** Short-TTL presigned read URL, or null when the value is unreadable. */
  url: string | null;
  expiresAt: string | null;
  /** True when the stored value predates the G-3 key contract. */
  legacy?: boolean;
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private payouts: PayoutService,
    private uploads: UploadsService,
    private refunds: RefundService,
    private tasks: TasksService,
  ) {}

  // KYC
  getPendingKyc() {
    return this.prisma.doerProfile.findMany({
      where: { kycStatus: 'PENDING' },
      include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * G-3: short-TTL presigned read URLs for a doer's private KYC documents.
   * The server derives every key from the stored profile row — client-supplied
   * keys are never accepted, which is what keeps the private bucket IDOR-free.
   * Values from before the key contract (URL-shaped) are flagged `legacy`.
   */
  async getKycDocuments(profileId: string) {
    const profile = await this.prisma.doerProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });
    if (!profile) throw new NotFoundException('Doer profile not found');

    const fields: Record<string, string | null> = {
      nicPhoto: profile.nicPhotoUrl,
      selfie: profile.selfieUrl,
      addressProof: profile.addressProofUrl,
      policeClearance: profile.policeClearanceUrl,
      drivingLicense: profile.drivingLicenseUrl,
      skillProof: profile.skillProofUrl,
    };

    const documents: Record<string, KycDocumentView> = {};
    for (const [name, value] of Object.entries(fields)) {
      if (!value) continue;
      if (ANY_KYC_KEY_PATTERN.test(value)) {
        const { url, expiresAt } = await this.uploads.presignRead(value);
        documents[name] = { key: value, url, expiresAt };
      } else {
        documents[name] = { key: value, url: null, expiresAt: null, legacy: true };
      }
    }

    return {
      profileId: profile.id,
      user: profile.user,
      kycStatus: profile.kycStatus,
      tier: profile.tier,
      documents,
    };
  }

  async approveKyc(profileId: string, adminPhone: string, tier: 'BRONZE' | 'SILVER' | 'GOLD' = 'BRONZE') {
    const profile = await this.prisma.doerProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Doer profile not found');

    const updated = await this.prisma.doerProfile.update({
      where: { id: profileId },
      data: { kycStatus: 'APPROVED', tier, kycReviewedAt: new Date() },
    });

    await this.prisma.kycReview.create({
      data: { doerProfileId: profileId, reviewerPhone: adminPhone, action: 'APPROVED' },
    });

    this.events.emit(NotificationEvent.KYC_REVIEWED, {
      userId: profile.userId,
      approved: true,
      tier,
    });

    return updated;
  }

  async rejectKyc(profileId: string, adminPhone: string, note: string) {
    const profile = await this.prisma.doerProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Doer profile not found');

    const updated = await this.prisma.doerProfile.update({
      where: { id: profileId },
      data: { kycStatus: 'REJECTED', kycReviewedAt: new Date(), kycReviewNote: note },
    });

    await this.prisma.kycReview.create({
      data: { doerProfileId: profileId, reviewerPhone: adminPhone, action: 'REJECTED', note },
    });

    this.events.emit(NotificationEvent.KYC_REVIEWED, {
      userId: profile.userId,
      approved: false,
      note,
    });

    return updated;
  }

  // Users
  getUsers(page = 1, limit = 50) {
    return this.prisma.user.findMany({
      include: { doerProfile: { select: { tier: true, kycStatus: true, totalJobsCompleted: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async banUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
  }

  // Disputes
  getDisputes(status?: 'OPEN' | 'RESOLVED' | 'CLOSED') {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            budget: true,
            poster: { select: { id: true, name: true, phone: true } },
            doer: { select: { id: true, name: true, phone: true } },
          },
        },
        raisedBy: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(
    disputeId: string,
    adminPhone: string,
    resolutionNote: string,
    refundPoster: boolean,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { task: { include: { escrow: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'RESOLVED',
          resolutionNote,
          resolvedByPhone: adminPhone,
          resolvedAt: new Date(),
        },
      });

      if (dispute.task.escrow) {
        await tx.escrow.update({
          where: { taskId: dispute.taskId },
          data: {
            status: refundPoster ? 'REFUNDED' : 'RELEASED',
            ...(refundPoster ? { refundedAt: new Date() } : { releasedAt: new Date() }),
          },
        });
      }

      await tx.task.update({
        where: { id: dispute.taskId },
        data: { status: 'COMPLETED' },
      });
    });

    return { resolved: true };
  }

  // --- G-1: Refund tooling ---

  listRefunds(status?: RefundStatusFilter) {
    return this.refunds.list(status);
  }

  /**
   * Manual refund for a task's escrow (approved decision #2). DISPUTED escrow
   * is excluded — that money is decided through dispute resolution (G-4).
   */
  async initiateEscrowRefund(taskId: string, adminPhone: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { taskId } });
    if (!escrow) throw new NotFoundException('Escrow not found for this task');
    if (escrow.status === 'DISPUTED') {
      throw new BadRequestException('Escrow is disputed — resolve the dispute instead');
    }
    return this.refunds.initiateForEscrow({
      escrowId: escrow.id,
      taskId,
      reason: 'ADMIN',
      initiatedBy: `admin:${adminPhone}`,
    });
  }

  retryRefund(refundId: string, adminPhone: string) {
    return this.refunds.retry(refundId, adminPhone);
  }

  // --- G-2: Task recovery ---

  listTasks(status?: TaskStatusFilter, page = 1, limit = 50) {
    return this.prisma.task.findMany({
      where: status ? { status } : undefined,
      include: {
        poster: { select: { id: true, name: true, phone: true } },
        doer: { select: { id: true, name: true, phone: true } },
        escrow: { select: { status: true, payherePaymentId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  forceCancelTask(taskId: string, adminPhone: string) {
    return this.tasks.forceCancel(taskId, adminPhone);
  }

  // P3-A: Payouts
  listPayouts(status?: PayoutStatusFilter) {
    return this.payouts.adminList(status);
  }

  markPayoutPaid(payoutId: string, providerRef?: string) {
    return this.payouts.markPaid(payoutId, providerRef);
  }

  exportPayoutsCsv(status?: PayoutStatusFilter) {
    return this.payouts.exportCsv(status);
  }

  // Stats
  async getStats() {
    const [users, tasks, completedTasks, openDisputes, totalEscrowHeld] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'COMPLETED' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.escrow.aggregate({
        where: { status: 'HELD' },
        _sum: { taskBudget: true },
      }),
    ]);

    return {
      users,
      tasks,
      completedTasks,
      openDisputes,
      escrowHeldLkr: totalEscrowHeld._sum.taskBudget ?? 0,
    };
  }
}

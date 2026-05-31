import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // KYC
  getPendingKyc() {
    return this.prisma.doerProfile.findMany({
      where: { kycStatus: 'PENDING' },
      include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
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

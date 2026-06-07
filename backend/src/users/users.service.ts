import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { doerProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      include: { doerProfile: true },
    });
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isDoer: true,
        isPoster: true,
        createdAt: true,
        doerProfile: {
          select: {
            tier: true,
            kycStatus: true,
            totalJobsCompleted: true,
            avgRating: true,
            onTimeRate: true,
          },
        },
        ratingsReceived: {
          select: { score: true, comment: true, isOnTime: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * P3-C (PDPA): export all personal data held about the user.
   */
  async exportMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        doerProfile: true,
        postedTasks: true,
        acceptedTasks: true,
        ratingsGiven: true,
        ratingsReceived: true,
        notifications: true,
        sentMessages: true,
        disputesRaised: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const payouts = await this.prisma.payout.findMany({ where: { doerId: id } });
    return { exportedAt: new Date().toISOString(), user, payouts };
  }

  /**
   * P3-C (PDPA): right to erasure. Soft-deletes and anonymizes PII while keeping
   * referential integrity for completed marketplace/accounting records.
   */
  async deleteMe(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        name: null,
        email: null,
        avatarUrl: null,
        fcmToken: null,
        phone: `deleted-${id}`,
      },
    });
    return { deleted: true };
  }
}

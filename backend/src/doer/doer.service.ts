import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';

@Injectable()
export class DoerService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.doerProfile.findUnique({
      where: { userId },
      include: { kycReviews: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!profile) throw new NotFoundException('Doer profile not found. Submit KYC to become a doer.');
    return profile;
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const existing = await this.prisma.doerProfile.findUnique({ where: { userId } });

    if (existing && existing.kycStatus === 'APPROVED') {
      throw new ConflictException('KYC already approved');
    }

    const profile = await this.prisma.doerProfile.upsert({
      where: { userId },
      update: {
        ...dto,
        kycStatus: 'PENDING',
        kycReviewedAt: null,
        kycReviewNote: null,
      },
      create: {
        userId,
        ...dto,
        kycStatus: 'PENDING',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { isDoer: true },
    });

    return profile;
  }

  async getMyTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { doerId: userId },
      include: { category: true, poster: { select: { id: true, name: true, phone: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

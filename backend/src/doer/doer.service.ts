import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';
import { PayoutMethodDto } from './dto/payout-method.dto.js';

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

    const kycData = {
      nicPhotoUrl: dto.nicPhotoUrl,
      selfieUrl: dto.selfieUrl,
      addressProofUrl: dto.addressProofUrl,
      policeClearanceUrl: dto.policeClearanceUrl,
      drivingLicenseUrl: dto.drivingLicenseUrl,
      skillProofUrl: dto.skillProofUrl,
      ref1Name: dto.ref1Name,
      ref1Phone: dto.ref1Phone,
      ref2Name: dto.ref2Name,
      ref2Phone: dto.ref2Phone,
      preferredPayoutMethod: dto.preferredPayoutMethod,
      bankAccountName: dto.bankAccountName,
      bankAccountNumber: dto.bankAccountNumber,
      bankName: dto.bankName,
      bankBranch: dto.bankBranch,
      mobileWalletProvider: dto.mobileWalletProvider,
      mobileWalletNumber: dto.mobileWalletNumber,
    };

    const profile = await this.prisma.doerProfile.upsert({
      where: { userId },
      update: {
        ...kycData,
        kycStatus: 'PENDING',
        kycReviewedAt: null,
        kycReviewNote: null,
      },
      create: {
        userId,
        ...kycData,
        kycStatus: 'PENDING',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { isDoer: true },
    });

    return profile;
  }

  // P3-A: doer sets/updates payout destination.
  async setPayoutMethod(userId: string, dto: PayoutMethodDto) {
    const profile = await this.prisma.doerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Doer profile not found. Submit KYC first.');
    }
    return this.prisma.doerProfile.update({
      where: { userId },
      data: {
        preferredPayoutMethod: dto.preferredPayoutMethod,
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankName: dto.bankName,
        bankBranch: dto.bankBranch,
        mobileWalletProvider: dto.mobileWalletProvider,
        mobileWalletNumber: dto.mobileWalletNumber,
      },
    });
  }

  // P3-A: doer payout history.
  getPayouts(userId: string) {
    return this.prisma.payout.findMany({
      where: { doerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyTasks(userId: string) {
    // P3-C: no poster phone exposure.
    return this.prisma.task.findMany({
      where: { doerId: userId },
      include: { category: true, poster: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

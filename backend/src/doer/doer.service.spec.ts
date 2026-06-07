import { ConflictException } from '@nestjs/common';
import { DoerService } from './doer.service';

// P1-A regression tests: KYC submission must persist payout fields without the
// blind-spread runtime crash (B1), via explicit field mapping.

function buildPrismaMock() {
  return {
    doerProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

const baseDto = {
  nicPhotoUrl: 'https://cdn.helpmi.lk/nic.jpg',
  selfieUrl: 'https://cdn.helpmi.lk/selfie.jpg',
  addressProofUrl: 'https://cdn.helpmi.lk/addr.jpg',
  preferredPayoutMethod: 'MOBILE_WALLET' as const,
  mobileWalletProvider: 'FriMi',
  mobileWalletNumber: '0771234567',
};

describe('DoerService.submitKyc (P1-A)', () => {
  let prisma: any;
  let service: DoerService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new DoerService(prisma);
  });

  it('persists payout fields and never spreads unknown DTO keys into Prisma', async () => {
    prisma.doerProfile.findUnique.mockResolvedValue(null);
    prisma.doerProfile.upsert.mockResolvedValue({ id: 'dp1', kycStatus: 'PENDING' });

    await service.submitKyc('user1', baseDto as any);

    expect(prisma.doerProfile.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.doerProfile.upsert.mock.calls[0][0];

    // Known payout columns are mapped through...
    expect(arg.create.preferredPayoutMethod).toBe('MOBILE_WALLET');
    expect(arg.create.mobileWalletProvider).toBe('FriMi');
    expect(arg.update.preferredPayoutMethod).toBe('MOBILE_WALLET');

    // ...and the explicit map only contains real DoerProfile columns.
    const allowed = new Set([
      'nicPhotoUrl', 'selfieUrl', 'addressProofUrl', 'policeClearanceUrl',
      'drivingLicenseUrl', 'skillProofUrl', 'ref1Name', 'ref1Phone', 'ref2Name',
      'ref2Phone', 'preferredPayoutMethod', 'bankAccountName', 'bankAccountNumber',
      'bankName', 'bankBranch', 'mobileWalletProvider', 'mobileWalletNumber',
      'kycStatus', 'kycReviewedAt', 'kycReviewNote',
    ]);
    for (const key of Object.keys(arg.update)) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  it('flips the user to a doer and sets status PENDING', async () => {
    prisma.doerProfile.findUnique.mockResolvedValue(null);
    prisma.doerProfile.upsert.mockResolvedValue({ id: 'dp1' });

    await service.submitKyc('user1', baseDto as any);

    expect(prisma.doerProfile.upsert.mock.calls[0][0].create.kycStatus).toBe('PENDING');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { isDoer: true },
    });
  });

  it('rejects resubmission once KYC is already APPROVED', async () => {
    prisma.doerProfile.findUnique.mockResolvedValue({ kycStatus: 'APPROVED' });

    await expect(service.submitKyc('user1', baseDto as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.doerProfile.upsert).not.toHaveBeenCalled();
  });
});

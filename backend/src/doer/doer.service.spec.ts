import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DoerService } from './doer.service';

// P1-A regression tests: KYC submission must persist payout fields without the
// blind-spread runtime crash (B1), via explicit field mapping.
// G-3: fixtures use private storage KEYS (the presign contract), and document
// keys must belong to the submitting user.

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
  nicPhotoUrl: 'kyc/nic/user1/aaaa-1111.jpg',
  selfieUrl: 'kyc/selfie/user1/bbbb-2222.jpg',
  addressProofUrl: 'kyc/address/user1/cccc-3333.jpg',
  preferredPayoutMethod: 'BANK' as const,
  bankAccountName: 'A. Perera',
  bankAccountNumber: '100254789632',
  bankName: 'Commercial Bank',
};

describe('DoerService.submitKyc (P1-A / G-3)', () => {
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
    expect(arg.create.preferredPayoutMethod).toBe('BANK');
    expect(arg.create.bankAccountNumber).toBe('100254789632');
    expect(arg.update.preferredPayoutMethod).toBe('BANK');

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

  it('G-3: rejects document keys that belong to another user (no upsert)', async () => {
    await expect(
      service.submitKyc('user1', { ...baseDto, nicPhotoUrl: 'kyc/nic/user2/zzzz-9.jpg' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.doerProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.doerProfile.upsert).not.toHaveBeenCalled();
  });

  it('G-3: rejects URL-shaped document values even at the service layer', async () => {
    await expect(
      service.submitKyc('user1', { ...baseDto, selfieUrl: 'https://cdn.helpmi.lk/s.jpg' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.doerProfile.upsert).not.toHaveBeenCalled();
  });
});

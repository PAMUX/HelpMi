import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

/**
 * G-3: admin KYC document review. (This file is the seed of the wider admin
 * suite — G-4 in Sprint 3 adds the dispute-resolution money-path tests.)
 */
function buildPrisma() {
  return {
    doerProfile: { findUnique: jest.fn() },
  } as any;
}

function buildUploads() {
  return {
    presignRead: jest
      .fn()
      .mockResolvedValue({ url: 'https://signed.example/get', expiresAt: '2026-01-01T00:00:00Z' }),
  } as any;
}

describe('AdminService.getKycDocuments (G-3)', () => {
  let prisma: any;
  let uploads: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = buildPrisma();
    uploads = buildUploads();
    service = new AdminService(prisma, { emit: jest.fn() } as any, {} as any, uploads);
  });

  it('404s when the profile does not exist', async () => {
    prisma.doerProfile.findUnique.mockResolvedValue(null);
    await expect(service.getKycDocuments('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(uploads.presignRead).not.toHaveBeenCalled();
  });

  it('presigns exactly the key-shaped documents, flags legacy URLs, omits empty fields', async () => {
    prisma.doerProfile.findUnique.mockResolvedValue({
      id: 'dp1',
      kycStatus: 'PENDING',
      tier: 'BRONZE',
      user: { id: 'u1', name: 'N', phone: '+94770000001' },
      nicPhotoUrl: 'kyc/nic/u1/aaa-1.jpg',
      selfieUrl: 'kyc/selfie/u1/bbb-2.png',
      addressProofUrl: 'https://cdn.helpmi.lk/legacy-addr.jpg', // pre-G-3 row
      policeClearanceUrl: null,
      drivingLicenseUrl: null,
      skillProofUrl: null,
    });

    const res = await service.getKycDocuments('dp1');

    // Server-derived keys only — presignRead called for the two key-shaped docs.
    expect(uploads.presignRead).toHaveBeenCalledTimes(2);
    expect(uploads.presignRead).toHaveBeenCalledWith('kyc/nic/u1/aaa-1.jpg');
    expect(uploads.presignRead).toHaveBeenCalledWith('kyc/selfie/u1/bbb-2.png');

    expect(res.documents.nicPhoto.url).toBe('https://signed.example/get');
    expect(res.documents.selfie.url).toBe('https://signed.example/get');
    expect(res.documents.addressProof).toEqual(
      expect.objectContaining({ url: null, legacy: true }),
    );
    expect(res.documents.policeClearance).toBeUndefined();
    expect(res.kycStatus).toBe('PENDING');
    expect(res.user.phone).toBe('+94770000001');
  });
});

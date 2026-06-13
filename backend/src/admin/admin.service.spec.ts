import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

/**
 * G-3: admin KYC document review · G-1/G-2: refund tooling + task recovery.
 * (G-4 in Sprint 3 adds the dispute-resolution money-path tests.)
 */
function buildPrisma() {
  return {
    doerProfile: { findUnique: jest.fn() },
    escrow: { findUnique: jest.fn() },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

function buildUploads() {
  return {
    presignRead: jest
      .fn()
      .mockResolvedValue({ url: 'https://signed.example/get', expiresAt: '2026-01-01T00:00:00Z' }),
  } as any;
}

function buildRefunds() {
  return {
    list: jest.fn().mockResolvedValue([]),
    retry: jest.fn().mockResolvedValue({ id: 'r1', status: 'COMPLETED' }),
    initiateForEscrow: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
  } as any;
}

function buildTasks() {
  return { forceCancel: jest.fn().mockResolvedValue({ id: 't1', status: 'CANCELLED' }) } as any;
}

function buildService(overrides: Partial<Record<'prisma' | 'uploads' | 'refunds' | 'tasks', any>> = {}) {
  const prisma = overrides.prisma ?? buildPrisma();
  const uploads = overrides.uploads ?? buildUploads();
  const refunds = overrides.refunds ?? buildRefunds();
  const tasks = overrides.tasks ?? buildTasks();
  const service = new AdminService(prisma, { emit: jest.fn() } as any, {} as any, uploads, refunds, tasks);
  return { service, prisma, uploads, refunds, tasks };
}

describe('AdminService.getKycDocuments (G-3)', () => {
  let prisma: any;
  let uploads: any;
  let service: AdminService;

  beforeEach(() => {
    ({ service, prisma, uploads } = buildService());
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

describe('AdminService refund tooling (G-1)', () => {
  it('initiateEscrowRefund: routes a HELD escrow to RefundService with the admin actor', async () => {
    const { service, prisma, refunds } = buildService();
    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', taskId: 't1', status: 'HELD' });

    await service.initiateEscrowRefund('t1', '+94770000001');

    expect(refunds.initiateForEscrow).toHaveBeenCalledWith({
      escrowId: 'e1', taskId: 't1', reason: 'ADMIN', initiatedBy: 'admin:+94770000001',
    });
  });

  it('initiateEscrowRefund: 404 without escrow; 400 for DISPUTED (dispute resolution owns it)', async () => {
    const { service, prisma, refunds } = buildService();

    prisma.escrow.findUnique.mockResolvedValue(null);
    await expect(service.initiateEscrowRefund('t1', '+94')).rejects.toBeInstanceOf(NotFoundException);

    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', taskId: 't1', status: 'DISPUTED' });
    await expect(service.initiateEscrowRefund('t1', '+94')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(refunds.initiateForEscrow).not.toHaveBeenCalled();
  });

  it('retryRefund delegates with the admin phone', async () => {
    const { service, refunds } = buildService();
    await service.retryRefund('r1', '+94770000001');
    expect(refunds.retry).toHaveBeenCalledWith('r1', '+94770000001');
  });

  it('listRefunds passes the status filter through', async () => {
    const { service, refunds } = buildService();
    await service.listRefunds('FAILED');
    expect(refunds.list).toHaveBeenCalledWith('FAILED');
  });
});

describe('AdminService task recovery (G-2)', () => {
  it('listTasks filters by status, paginates, and includes escrow state', async () => {
    const { service, prisma } = buildService();
    await service.listTasks('CANCELLED', 2, 25);

    const arg = prisma.task.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: 'CANCELLED' });
    expect(arg.skip).toBe(25);
    expect(arg.take).toBe(25);
    expect(arg.include.escrow).toBeDefined();
  });

  it('forceCancelTask delegates to TasksService with the admin phone', async () => {
    const { service, tasks } = buildService();
    await service.forceCancelTask('t1', '+94770000001');
    expect(tasks.forceCancel).toHaveBeenCalledWith('t1', '+94770000001');
  });
});

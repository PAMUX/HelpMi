import { PayoutService } from './payout.service';

function buildPrisma() {
  return {
    payout: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'po1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    doerProfile: { findUnique: jest.fn() },
  } as any;
}

describe('PayoutService.createForEscrowRelease (P3-A)', () => {
  let prisma: any; let provider: any; let service: PayoutService;

  beforeEach(() => {
    prisma = buildPrisma();
    provider = { dispatch: jest.fn().mockResolvedValue({ status: 'PROCESSING', providerRef: 'r1' }) };
    service = new PayoutService(prisma, provider);
  });

  it('is idempotent: returns existing payout, never creates a duplicate', async () => {
    prisma.payout.findUnique.mockResolvedValue({ id: 'existing', escrowId: 'e1' });
    const res = await service.createForEscrowRelease({ escrowId: 'e1', taskId: 't1', doerId: 'd1', amount: 1700 });
    expect(res).toEqual({ id: 'existing', escrowId: 'e1' });
    expect(prisma.payout.create).not.toHaveBeenCalled();
  });

  it('G-7A: a stored MOBILE_WALLET preference is coerced to BANK (launch scope)', async () => {
    prisma.payout.findUnique.mockResolvedValue(null);
    prisma.doerProfile.findUnique.mockResolvedValue({
      preferredPayoutMethod: 'MOBILE_WALLET', mobileWalletProvider: 'FriMi', mobileWalletNumber: '077',
      bankAccountName: 'A. Perera', bankAccountNumber: '123456', bankName: 'ComBank',
    });
    prisma.payout.create.mockResolvedValue({ id: 'po1', method: 'BANK' });
    provider.dispatch.mockResolvedValue({ status: 'PENDING' });

    const res = await service.createForEscrowRelease({ escrowId: 'e1', taskId: 't1', doerId: 'd1', amount: 1700 });

    expect(prisma.payout.create).toHaveBeenCalledTimes(1);
    expect(prisma.payout.create.mock.calls[0][0].data.method).toBe('BANK');
    expect(prisma.payout.create.mock.calls[0][0].data.destinationSnapshot).toEqual(
      expect.objectContaining({ bankAccountNumber: '123456' }),
    );
    expect(provider.dispatch).toHaveBeenCalledWith(expect.objectContaining({ method: 'BANK' }));
    expect(res.status).toBe('PENDING');
  });

  it('bank payout: stays PENDING for manual settlement', async () => {
    prisma.payout.findUnique.mockResolvedValue(null);
    prisma.doerProfile.findUnique.mockResolvedValue({
      preferredPayoutMethod: 'BANK', bankAccountNumber: '123',
    });
    prisma.payout.create.mockResolvedValue({ id: 'po1', method: 'BANK' });
    provider.dispatch.mockResolvedValue({ status: 'PENDING' });

    const res = await service.createForEscrowRelease({ escrowId: 'e1', taskId: 't1', doerId: 'd1', amount: 1700 });
    expect(res.status).toBe('PENDING');
  });

  it('create unique-violation falls back to the existing row', async () => {
    prisma.payout.findUnique
      .mockResolvedValueOnce(null)                 // initial check
      .mockResolvedValueOnce({ id: 'dup', escrowId: 'e1' }); // after create throws
    prisma.doerProfile.findUnique.mockResolvedValue({ preferredPayoutMethod: 'BANK' });
    prisma.payout.create.mockRejectedValue(new Error('Unique constraint failed'));

    const res = await service.createForEscrowRelease({ escrowId: 'e1', taskId: 't1', doerId: 'd1', amount: 1700 });
    expect(res).toEqual({ id: 'dup', escrowId: 'e1' });
  });
});

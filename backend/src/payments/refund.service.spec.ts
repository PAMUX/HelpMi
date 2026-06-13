import { BadRequestException } from '@nestjs/common';
import { RefundService } from './refund.service';

/**
 * G-1: refund lifecycle — every new state transition is covered:
 *  HELD→REFUND_PENDING (claim) · PENDING→queued (unconfigured) ·
 *  PENDING/FAILED→PROCESSING→COMPLETED (+escrow REFUNDED) ·
 *  PROCESSING→FAILED · retry guards · reconcile sweep.
 */
function buildPrisma() {
  return {
    escrow: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    refund: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(undefined),
    ),
  } as any;
}

const heldEscrow = {
  id: 'e1',
  taskId: 't1',
  status: 'HELD',
  payherePaymentId: 'PAY1',
  taskBudget: 2000,
  platformFeeFromPoster: 100,
};

function configuredClient(result: any = { success: true, providerRef: 'RF1' }) {
  return { isConfigured: jest.fn(() => true), refundPayment: jest.fn().mockResolvedValue(result) } as any;
}

describe('RefundService (G-1)', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  it('claims HELD→REFUND_PENDING, records budget+posterFee, completes via provider, escrow→REFUNDED', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.escrow.findUnique.mockResolvedValue(heldEscrow);
    prisma.refund.findUnique
      .mockResolvedValueOnce(null) // initiate pre-check
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING', escrowId: 'e1', taskId: 't1', reason: 'CANCEL', escrow: heldEscrow }); // execute load
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'PENDING' });

    const res = await service.initiateForEscrow({
      escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'user-poster',
    });

    // money-state claim
    expect(prisma.escrow.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', status: { in: ['HELD', 'DISPUTED'] } },
      data: { status: 'REFUND_PENDING' },
    });
    // ledger: full charge back to the poster
    expect(prisma.refund.create.mock.calls[0][0].data.amount).toBe(2100);
    expect(prisma.refund.create.mock.calls[0][0].data.initiatedBy).toBe('user-poster');
    // provider called with the captured payment id
    expect(client.refundPayment).toHaveBeenCalledWith('PAY1', expect.stringContaining('t1'));
    // COMPLETED + escrow REFUNDED committed together
    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', providerRef: 'RF1' }) }),
    );
    expect(prisma.escrow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }),
    );
    expect(res.status).toBe('COMPLETED');
  });

  it('queues (stays PENDING) when the Merchant API is not configured — no PROCESSING claim', async () => {
    const client = { isConfigured: jest.fn(() => false), refundPayment: jest.fn() } as any;
    const service = new RefundService(prisma, client);
    prisma.escrow.findUnique.mockResolvedValue(heldEscrow);
    prisma.refund.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING', escrowId: 'e1', escrow: heldEscrow });
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'PENDING' });

    const res = await service.initiateForEscrow({
      escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'u1',
    });

    expect(client.refundPayment).not.toHaveBeenCalled();
    expect(prisma.refund.updateMany).not.toHaveBeenCalled(); // no PROCESSING claim
    expect(res.failureReason).toContain('not configured');
    expect(prisma.escrow.update).not.toHaveBeenCalled(); // never REFUNDED without provider
  });

  it('provider failure → FAILED with reason; escrow stays REFUND_PENDING', async () => {
    const client = configuredClient({ success: false, error: 'Insufficient balance' });
    const service = new RefundService(prisma, client);
    prisma.escrow.findUnique.mockResolvedValue(heldEscrow);
    prisma.refund.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING', escrowId: 'e1', escrow: heldEscrow });
    prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'PENDING' });

    const res = await service.initiateForEscrow({
      escrowId: 'e1', taskId: 't1', reason: 'ADMIN', initiatedBy: 'admin:+94',
    });

    expect(res.status).toBe('FAILED');
    expect(res.failureReason).toBe('Insufficient balance');
    expect(prisma.escrow.update).not.toHaveBeenCalled();
  });

  it('idempotent: COMPLETED/PROCESSING refunds are returned untouched', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.escrow.findUnique.mockResolvedValue(heldEscrow);
    prisma.refund.findUnique.mockResolvedValue({ id: 'r1', status: 'COMPLETED' });

    const res = await service.initiateForEscrow({
      escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'u1',
    });

    expect(res.status).toBe('COMPLETED');
    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(client.refundPayment).not.toHaveBeenCalled();
  });

  it('rejects escrows with nothing to refund (RELEASED / no captured payment)', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.refund.findUnique.mockResolvedValue(null);

    prisma.escrow.findUnique.mockResolvedValue({ ...heldEscrow, status: 'RELEASED' });
    await expect(
      service.initiateForEscrow({ escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'u1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.escrow.findUnique.mockResolvedValue({ ...heldEscrow, payherePaymentId: null });
    await expect(
      service.initiateForEscrow({ escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'u1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unique-violation on concurrent create falls back to the existing refund', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.escrow.findUnique.mockResolvedValue(heldEscrow);
    prisma.refund.findUnique
      .mockResolvedValueOnce(null) // pre-check
      .mockResolvedValueOnce({ id: 'dup', status: 'COMPLETED' }); // after create throws
    prisma.refund.create.mockRejectedValue(new Error('Unique constraint failed'));

    const res = await service.initiateForEscrow({
      escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'u1',
    });
    expect(res).toEqual({ id: 'dup', status: 'COMPLETED' });
  });

  it('retry: 400 on COMPLETED/PROCESSING; re-executes FAILED with admin actor', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);

    prisma.refund.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'COMPLETED' });
    await expect(service.retry('r1', '+94770000001')).rejects.toBeInstanceOf(BadRequestException);

    prisma.refund.findUnique.mockResolvedValueOnce({ id: 'r1', status: 'PROCESSING' });
    await expect(service.retry('r1', '+94770000001')).rejects.toBeInstanceOf(BadRequestException);

    prisma.refund.findUnique
      .mockResolvedValueOnce({ id: 'r1', status: 'FAILED' }) // retry guard
      .mockResolvedValueOnce({ id: 'r1', status: 'FAILED', escrowId: 'e1', taskId: 't1', reason: 'CANCEL', escrow: heldEscrow }); // execute load
    const res = await service.retry('r1', '+94770000001');
    expect(prisma.refund.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSING', lastAttemptedBy: 'admin:+94770000001' }),
      }),
    );
    expect(res.status).toBe('COMPLETED');
  });

  it('reconcile: re-drives REFUND_PENDING escrows and repairs CANCELLED+HELD anomalies', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.escrow.findMany
      .mockResolvedValueOnce([{ id: 'e1', taskId: 't1' }]) // REFUND_PENDING
      .mockResolvedValueOnce([{ id: 'e2', taskId: 't2' }]); // anomaly HELD+CANCELLED
    const spy = jest
      .spyOn(service, 'initiateForEscrow')
      .mockResolvedValue({ status: 'COMPLETED' } as any);

    const res = await service.reconcile();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: 'e1', initiatedBy: 'system:reconcile' }),
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ escrowId: 'e2' }));
    expect(res).toEqual({ scanned: 2, completed: 2 });
  });

  it('reconcile continues when one escrow fails', async () => {
    const client = configuredClient();
    const service = new RefundService(prisma, client);
    prisma.escrow.findMany
      .mockResolvedValueOnce([{ id: 'e1', taskId: 't1' }, { id: 'e2', taskId: 't2' }])
      .mockResolvedValueOnce([]);
    jest
      .spyOn(service, 'initiateForEscrow')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ status: 'COMPLETED' } as any);

    const res = await service.reconcile();
    expect(res).toEqual({ scanned: 2, completed: 1 });
  });
});

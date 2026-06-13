import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { NotificationEvent } from '../notifications/events/notification-events';

function buildEvents() {
  return { emit: jest.fn() } as any;
}

function buildPayouts() {
  return { createForEscrowRelease: jest.fn().mockResolvedValue({ id: 'po1' }) } as any;
}

function buildRefunds() {
  return { initiateForEscrow: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }) } as any;
}

function buildPrismaMock() {
  const tx = {
    escrow: { updateMany: jest.fn() },
    doerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    task: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    _tx: tx,
    category: { findUnique: jest.fn() },
    task: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 't1', ...data })),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't1', confirmedAt: new Date() }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 't1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    escrow: { create: jest.fn(), findUnique: jest.fn() },
    postingFee: { create: jest.fn() },
    doerProfile: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  } as any;
}

describe('TasksService.create (P1-B / P3-B pending payment)', () => {
  let prisma: any; let events: any; let payouts: any; let service: TasksService;

  beforeEach(() => {
    prisma = buildPrismaMock(); events = buildEvents(); payouts = buildPayouts();
    service = new TasksService(prisma, events, payouts, buildRefunds());
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', isActive: true, minTier: 'BRONZE' });
  });

  it('ESCROW task -> PENDING_PAYMENT + escrow, no announce', async () => {
    await service.create('poster1', {
      categoryId: 'c1', title: 'Queue', description: 'x'.repeat(25),
      locationLat: 6.9, locationLng: 79.8, locationAddress: 'Colombo', budget: 2000, paymentMode: 'ESCROW',
    } as any);
    expect(prisma.task.create.mock.calls[0][0].data.status).toBe('PENDING_PAYMENT');
    expect(prisma.escrow.create).toHaveBeenCalledTimes(1);
    expect(prisma.postingFee.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(NotificationEvent.TASK_POSTED, expect.anything());
  });

  it('CASH task -> PENDING_PAYMENT + posting fee, no announce (P3-B)', async () => {
    await service.create('poster1', {
      categoryId: 'c1', title: 'Queue', description: 'x'.repeat(25),
      locationLat: 6.9, locationLng: 79.8, locationAddress: 'Colombo', budget: 2000, paymentMode: 'CASH',
    } as any);
    expect(prisma.task.create.mock.calls[0][0].data.status).toBe('PENDING_PAYMENT');
    expect(prisma.postingFee.create).toHaveBeenCalledTimes(1);
    expect(prisma.escrow.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(NotificationEvent.TASK_POSTED, expect.anything());
  });
});

describe('TasksService.accept (funding gate + no phone leak)', () => {
  let prisma: any; let events: any; let service: TasksService;

  beforeEach(() => {
    prisma = buildPrismaMock(); events = buildEvents();
    service = new TasksService(prisma, events, buildPayouts(), buildRefunds());
    prisma.task.findUnique.mockResolvedValue({
      id: 't1', status: 'OPEN', posterId: 'poster1', paymentMode: 'ESCROW', requiredTier: 'BRONZE', title: 'T',
    });
    prisma.doerProfile.findUnique.mockResolvedValue({ kycStatus: 'APPROVED', tier: 'BRONZE' });
  });

  it('rejects accept when escrow not HELD', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(service.accept('t1', 'doer1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts when HELD via CAS, emits TASK_ACCEPTED, does not select poster phone', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ status: 'HELD' });
    await service.accept('t1', 'doer1');
    // G-5: assignment must be a guarded compare-and-swap, not a blind update.
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1', status: 'OPEN', doerId: null },
        data: expect.objectContaining({ status: 'ASSIGNED', doerId: 'doer1' }),
      }),
    );
    const include = prisma.task.findUniqueOrThrow.mock.calls[0][0].include;
    expect(include.poster.select.phone).toBeUndefined();
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.TASK_ACCEPTED, expect.objectContaining({ taskId: 't1' }));
  });

  it('G-5 CAS-miss: a concurrent winner means 400 and NO event for the loser', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ status: 'HELD' });
    prisma.task.updateMany.mockResolvedValue({ count: 0 }); // someone else won the row
    await expect(service.accept('t1', 'doer1')).rejects.toBeInstanceOf(BadRequestException);
    expect(events.emit).not.toHaveBeenCalled();
    expect(prisma.task.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('TasksService.confirm + releaseEscrow (P3-A payout)', () => {
  let prisma: any; let events: any; let payouts: any; let service: TasksService;

  beforeEach(() => {
    prisma = buildPrismaMock(); events = buildEvents(); payouts = buildPayouts();
    service = new TasksService(prisma, events, payouts, buildRefunds());
    prisma.task.findUnique.mockResolvedValue({
      id: 't1', status: 'COMPLETED', posterId: 'poster1', doerId: 'doer1', paymentMode: 'ESCROW', title: 'T',
    });
  });

  it('refuses release when escrow not HELD', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(service.confirm('t1', 'poster1')).rejects.toBeInstanceOf(BadRequestException);
    expect(payouts.createForEscrowRelease).not.toHaveBeenCalled();
  });

  it('on release creates exactly one payout + emits PAYMENT_RELEASED', async () => {
    prisma.escrow.findUnique
      .mockResolvedValueOnce({ status: 'HELD' })             // confirm guard
      .mockResolvedValue({ id: 'e1', netDoerPayout: 1700 }); // post-release fetch
    prisma._tx.escrow.updateMany.mockResolvedValue({ count: 1 });

    await service.confirm('t1', 'poster1');

    expect(payouts.createForEscrowRelease).toHaveBeenCalledTimes(1);
    expect(payouts.createForEscrowRelease).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: 'e1', taskId: 't1', doerId: 'doer1', amount: 1700 }));
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.PAYMENT_RELEASED, expect.objectContaining({ taskId: 't1' }));
  });

  it('idempotent: no payout when nothing was released', async () => {
    prisma._tx.escrow.updateMany.mockResolvedValue({ count: 0 });
    const released = await service.releaseEscrow('t1', 'doer1');
    expect(released).toBe(false);
    expect(payouts.createForEscrowRelease).not.toHaveBeenCalled();
  });
});

describe('TasksService.findById (P3-C participant detail)', () => {
  let prisma: any; let service: TasksService;
  const full = {
    id: 't1', posterId: 'poster1', doerId: 'doer1', title: 'T',
    escrow: { id: 'e1' }, dispute: { id: 'd1' }, doer: { id: 'doer1', name: 'D' },
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TasksService(prisma, buildEvents(), buildPayouts(), buildRefunds());
    prisma.task.findUnique.mockResolvedValue({ ...full });
  });

  it('participant sees escrow + dispute', async () => {
    const r: any = await service.findById('t1', 'poster1');
    expect(r.escrow).toBeDefined();
    expect(r.dispute).toBeDefined();
  });

  it('non-participant gets stripped view (no escrow/dispute/doer)', async () => {
    const r: any = await service.findById('t1', 'stranger');
    expect(r.escrow).toBeUndefined();
    expect(r.dispute).toBeUndefined();
    expect(r.doer).toBeUndefined();
    expect(r.id).toBe('t1');
  });

  it('throws when task missing', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.findById('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TasksService.cancel / forceCancel (G-2 transactional + G-1 auto-refund)', () => {
  let prisma: any; let events: any; let refunds: any; let service: TasksService;

  const baseTask = {
    id: 't1', status: 'OPEN', posterId: 'poster1', doerId: null,
    paymentMode: 'ESCROW', title: 'T',
  };

  beforeEach(() => {
    prisma = buildPrismaMock(); events = buildEvents(); refunds = buildRefunds();
    service = new TasksService(prisma, events, buildPayouts(), refunds);
    prisma.task.findUnique.mockResolvedValue({ ...baseTask });
    prisma.task.findUniqueOrThrow.mockResolvedValue({ id: 't1', status: 'CANCELLED' });
    prisma._tx.escrow.updateMany.mockResolvedValue({ count: 1 });
  });

  it('HELD escrow: task CANCELLED + escrow REFUND_PENDING in one transaction, then auto-refund (decision #1)', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: 'REFUND_PENDING' });

    const res = await service.cancel('t1', 'poster1');

    // CAS inside the tx — task first, escrow second (same order as webhook)
    expect(prisma._tx.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 't1' }),
        data: { status: 'CANCELLED' },
      }));
    expect(prisma._tx.escrow.updateMany).toHaveBeenCalledWith({
      where: { taskId: 't1', status: 'HELD' },
      data: { status: 'REFUND_PENDING' },
    });
    expect(refunds.initiateForEscrow).toHaveBeenCalledWith({
      escrowId: 'e1', taskId: 't1', reason: 'CANCEL', initiatedBy: 'poster1',
    });
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.TASK_CANCELLED, expect.objectContaining({ byUserId: 'poster1' }));
    expect(res.status).toBe('CANCELLED');
  });

  it('unpaid PENDING escrow: cancel succeeds, no refund initiated (no money captured)', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDING' });

    await service.cancel('t1', 'poster1');

    expect(refunds.initiateForEscrow).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalled();
  });

  it('CASH task: no escrow ops, no refund, still notifies', async () => {
    prisma.task.findUnique.mockResolvedValue({ ...baseTask, paymentMode: 'CASH' });

    await service.cancel('t1', 'poster1');

    expect(prisma._tx.escrow.updateMany).not.toHaveBeenCalled();
    expect(refunds.initiateForEscrow).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalled();
  });

  it('G-2 CAS-miss (double-cancel race): 400, no money writes, no event', async () => {
    prisma._tx.task.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancel('t1', 'poster1')).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma._tx.escrow.updateMany).not.toHaveBeenCalled();
    expect(refunds.initiateForEscrow).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('terminal states are rejected before any write', async () => {
    prisma.task.findUnique.mockResolvedValue({ ...baseTask, status: 'COMPLETED' });
    await expect(service.cancel('t1', 'poster1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('non-participants cannot cancel', async () => {
    await expect(service.cancel('t1', 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refund-initiation failure never undoes the cancel (sweep retries later)', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: 'REFUND_PENDING' });
    refunds.initiateForEscrow.mockRejectedValue(new Error('provider down'));

    const res = await service.cancel('t1', 'poster1');

    expect(res.status).toBe('CANCELLED');
    expect(events.emit).toHaveBeenCalled();
  });

  it('forceCancel (admin recovery): skips participant check, records admin actor', async () => {
    prisma.escrow.findUnique.mockResolvedValue({ id: 'e1', status: 'REFUND_PENDING' });

    await service.forceCancel('t1', '+94770000001');

    expect(refunds.initiateForEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ initiatedBy: 'admin:+94770000001' }));
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.TASK_CANCELLED,
      expect.objectContaining({ byUserId: 'admin:+94770000001' }));
  });
});

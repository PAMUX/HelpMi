import { SchedulerService } from './scheduler.service';

function buildPrismaMock() {
  return {
    task: { findMany: jest.fn() },
  } as any;
}

describe('SchedulerService.autoReleaseEscrows (P1-D)', () => {
  let prisma: any;
  let tasks: any;
  let service: SchedulerService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tasks = { releaseEscrow: jest.fn() };
    service = new SchedulerService(prisma, tasks);
  });

  it('queries only COMPLETED, unconfirmed, escrow-HELD tasks past the 24h cutoff', async () => {
    prisma.task.findMany.mockResolvedValue([]);

    await service.autoReleaseEscrows();

    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where.paymentMode).toBe('ESCROW');
    expect(where.confirmedAt).toBeNull();
    expect(where.escrow).toEqual({ status: 'HELD' });
    expect(where.completedAt.lte).toBeInstanceOf(Date);
    const ageMs = Date.now() - where.completedAt.lte.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(23.9 * 3600 * 1000);
    expect(ageMs).toBeLessThanOrEqual(24.1 * 3600 * 1000);
  });

  it('releases each due task and counts successful releases', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 't1', doerId: 'd1' },
      { id: 't2', doerId: 'd2' },
    ]);
    tasks.releaseEscrow.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.autoReleaseEscrows();

    expect(tasks.releaseEscrow).toHaveBeenCalledTimes(2);
    expect(tasks.releaseEscrow).toHaveBeenCalledWith('t1', 'd1', { auto: true });
    expect(result).toEqual({ scanned: 2, released: 1 });
  });

  it('continues the batch when one release throws', async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: 't1', doerId: 'd1' },
      { id: 't2', doerId: 'd2' },
    ]);
    tasks.releaseEscrow
      .mockRejectedValueOnce(new Error('db blip'))
      .mockResolvedValueOnce(true);

    const result = await service.autoReleaseEscrows();

    expect(result).toEqual({ scanned: 2, released: 1 });
  });
});

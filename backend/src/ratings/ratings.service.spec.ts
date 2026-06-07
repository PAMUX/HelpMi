import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { NotificationEvent } from '../notifications/events/notification-events';

function buildPrisma() {
  return {
    task: { findUnique: jest.fn() },
    rating: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data })),
      findMany: jest.fn().mockResolvedValue([{ score: 5, isOnTime: true }]),
    },
    doerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'd1' }), update: jest.fn() },
  } as any;
}

describe('RatingsService.create (P2-A)', () => {
  let prisma: any; let events: any; let service: RatingsService;

  beforeEach(() => {
    prisma = buildPrisma();
    events = { emit: jest.fn() };
    service = new RatingsService(prisma, events);
  });

  it('poster rates the doer on a completed task + emits RATING_RECEIVED', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'COMPLETED' });
    await service.create('p1', { taskId: 't1', score: 5 } as any);
    expect(prisma.rating.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.RATING_RECEIVED,
      expect.objectContaining({ rateeId: 'd1', raterId: 'p1', score: 5 }));
  });

  it('rejects rating a non-completed task', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'OPEN' });
    await expect(service.create('p1', { taskId: 't1', score: 5 } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-participants', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'COMPLETED' });
    await expect(service.create('stranger', { taskId: 't1', score: 5 } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate rating', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'COMPLETED' });
    prisma.rating.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create('p1', { taskId: 't1', score: 4 } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when task missing', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.create('p1', { taskId: 'x', score: 5 } as any))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

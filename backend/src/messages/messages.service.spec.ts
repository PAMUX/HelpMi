import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { NotificationEvent } from '../notifications/events/notification-events';

function buildPrisma() {
  return {
    task: { findUnique: jest.fn() },
    message: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'm1', ...data })),
      updateMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(3),
    },
  } as any;
}

describe('MessagesService.sendMessage (P2-A)', () => {
  let prisma: any; let events: any; let service: MessagesService;

  beforeEach(() => {
    prisma = buildPrisma();
    events = { emit: jest.fn() };
    service = new MessagesService(prisma, events);
  });

  it('sends and notifies the counterpart', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'ASSIGNED' });
    await service.sendMessage('t1', 'p1', { content: 'hello there' } as any);
    expect(prisma.message.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      NotificationEvent.MESSAGE_SENT,
      expect.objectContaining({ taskId: 't1', senderId: 'p1', recipientId: 'd1' }));
  });

  it('rejects non-participants', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'ASSIGNED' });
    await expect(service.sendMessage('t1', 'stranger', { content: 'hi' } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects messaging on a closed task', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: 'd1', status: 'COMPLETED' });
    await expect(service.sendMessage('t1', 'p1', { content: 'hi' } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when task missing', async () => {
    prisma.task.findUnique.mockResolvedValue(null);
    await expect(service.sendMessage('x', 'p1', { content: 'hi' } as any))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not emit when there is no counterpart yet (no doer)', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', posterId: 'p1', doerId: null, status: 'OPEN' });
    await service.sendMessage('t1', 'p1', { content: 'hi there' } as any);
    expect(events.emit).not.toHaveBeenCalled();
  });
});

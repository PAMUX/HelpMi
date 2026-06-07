import { NotificationsService } from './notifications.service';

// P2-A: persistence + best-effort push; failures never throw.

describe('NotificationsService.send (P2-A)', () => {
  let prisma: any;
  let push: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      user: { findUnique: jest.fn() },
    };
    push = { sendToToken: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(prisma, push);
  });

  it('persists a notification and pushes when the user has an fcmToken', async () => {
    prisma.user.findUnique.mockResolvedValue({ fcmToken: 'tok123' });
    const res = await service.send('u1', 'TASK_ACCEPTED', 'Title', 'Body', 't1');
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', type: 'TASK_ACCEPTED' }) }),
    );
    expect(push.sendToToken).toHaveBeenCalledWith('tok123', expect.objectContaining({ title: 'Title' }));
    expect(res).toEqual({ id: 'n1' });
  });

  it('skips push when the user has no fcmToken', async () => {
    prisma.user.findUnique.mockResolvedValue({ fcmToken: null });
    await service.send('u1', 'TASK_ACCEPTED', 'Title', 'Body');
    expect(push.sendToToken).not.toHaveBeenCalled();
  });

  it('never throws if persistence fails (isolates business transactions)', async () => {
    prisma.notification.create.mockRejectedValue(new Error('db down'));
    const res = await service.send('u1', 'TASK_ACCEPTED', 'Title', 'Body');
    expect(res).toBeNull();
  });
});

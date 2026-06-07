import { NotificationsListener } from './notifications.listener';

// P2-A: the listener maps each domain event to a persisted notification.

function buildNotifications() {
  return {
    send: jest.fn().mockResolvedValue({}),
    sendToMany: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('NotificationsListener (P2-A)', () => {
  let prisma: any;
  let notifications: any;
  let listener: NotificationsListener;

  beforeEach(() => {
    prisma = { doerProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'd1' }, { userId: 'd2' }]) } };
    notifications = buildNotifications();
    listener = new NotificationsListener(prisma, notifications);
  });

  it('TASK_POSTED fans out to tier-eligible doers', async () => {
    await listener.onTaskPosted({ taskId: 't1', posterId: 'p1', title: 'T', requiredTier: 'BRONZE' });
    expect(prisma.doerProfile.findMany).toHaveBeenCalled();
    expect(notifications.sendToMany).toHaveBeenCalledWith(
      ['d1', 'd2'], 'TASK_POSTED', expect.any(String), 'T', 't1',
    );
  });

  it('TASK_ACCEPTED notifies the poster', async () => {
    await listener.onTaskAccepted({ taskId: 't1', posterId: 'p1', doerId: 'd1', title: 'T' });
    expect(notifications.send).toHaveBeenCalledWith('p1', 'TASK_ACCEPTED', expect.any(String), expect.any(String), 't1');
  });

  it('TASK_COMPLETED notifies the poster', async () => {
    await listener.onTaskCompleted({ taskId: 't1', posterId: 'p1', doerId: 'd1', title: 'T' });
    expect(notifications.send).toHaveBeenCalledWith('p1', 'TASK_COMPLETED', expect.any(String), expect.any(String), 't1');
  });

  it('TASK_CONFIRMED notifies the doer', async () => {
    await listener.onTaskConfirmed({ taskId: 't1', posterId: 'p1', doerId: 'd1', title: 'T' });
    expect(notifications.send).toHaveBeenCalledWith('d1', 'TASK_CONFIRMED', expect.any(String), expect.any(String), 't1');
  });

  it('PAYMENT_RELEASED notifies the doer with the amount', async () => {
    await listener.onPaymentReleased({ taskId: 't1', doerId: 'd1', amount: 1700, auto: true });
    expect(notifications.send).toHaveBeenCalledWith(
      'd1', 'PAYMENT_RELEASED', expect.any(String), expect.stringContaining('1700'), 't1',
    );
  });

  it('TASK_CANCELLED notifies the other party only', async () => {
    await listener.onTaskCancelled({ taskId: 't1', posterId: 'p1', doerId: 'd1', byUserId: 'p1', title: 'T' });
    expect(notifications.sendToMany).toHaveBeenCalledWith(['d1'], 'TASK_CANCELLED', expect.any(String), expect.any(String), 't1');
  });

  it('TASK_DISPUTED notifies the other party only', async () => {
    await listener.onTaskDisputed({ taskId: 't1', posterId: 'p1', doerId: 'd1', byUserId: 'd1', title: 'T' });
    expect(notifications.sendToMany).toHaveBeenCalledWith(['p1'], 'TASK_DISPUTED', expect.any(String), expect.any(String), 't1');
  });

  it('MESSAGE_SENT notifies the recipient', async () => {
    await listener.onMessageSent({ taskId: 't1', senderId: 's1', recipientId: 'r1', preview: 'hi' });
    expect(notifications.send).toHaveBeenCalledWith('r1', 'NEW_MESSAGE', expect.any(String), 'hi', 't1');
  });

  it('KYC_REVIEWED approved -> KYC_APPROVED', async () => {
    await listener.onKycReviewed({ userId: 'u1', approved: true, tier: 'SILVER' });
    expect(notifications.send).toHaveBeenCalledWith('u1', 'KYC_APPROVED', expect.any(String), expect.stringContaining('SILVER'));
  });

  it('KYC_REVIEWED rejected -> KYC_REJECTED with note', async () => {
    await listener.onKycReviewed({ userId: 'u1', approved: false, note: 'blurry' });
    expect(notifications.send).toHaveBeenCalledWith('u1', 'KYC_REJECTED', expect.any(String), expect.stringContaining('blurry'));
  });

  it('RATING_RECEIVED notifies the ratee', async () => {
    await listener.onRatingReceived({ rateeId: 'u1', raterId: 'u2', taskId: 't1', score: 5 });
    expect(notifications.send).toHaveBeenCalledWith('u1', 'RATING_RECEIVED', expect.any(String), expect.stringContaining('5'), 't1');
  });
});

/**
 * P2-A: domain events emitted by business services and consumed by the
 * NotificationsListener. Services depend only on EventEmitter2 (global) and
 * these constants — never on NotificationsService directly — so notification
 * delivery is fully decoupled from business transactions.
 */
export const NotificationEvent = {
  TASK_POSTED: 'task.posted',
  TASK_ACCEPTED: 'task.accepted',
  TASK_COMPLETED: 'task.completed',
  TASK_CONFIRMED: 'task.confirmed',
  PAYMENT_RELEASED: 'payment.released',
  TASK_CANCELLED: 'task.cancelled',
  TASK_DISPUTED: 'task.disputed',
  MESSAGE_SENT: 'message.sent',
  KYC_REVIEWED: 'kyc.reviewed',
  RATING_RECEIVED: 'rating.received',
} as const;

export interface TaskPostedEvent {
  taskId: string;
  posterId: string;
  title: string;
  requiredTier: 'BRONZE' | 'SILVER' | 'GOLD';
}

export interface TaskAcceptedEvent {
  taskId: string;
  posterId: string;
  doerId: string;
  title: string;
}

export interface TaskCompletedEvent {
  taskId: string;
  posterId: string;
  doerId: string;
  title: string;
}

export interface TaskConfirmedEvent {
  taskId: string;
  posterId: string;
  doerId: string | null;
  title: string;
}

export interface PaymentReleasedEvent {
  taskId: string;
  doerId: string | null;
  amount: number;
  auto: boolean;
}

export interface TaskCancelledEvent {
  taskId: string;
  posterId: string;
  doerId: string | null;
  byUserId: string;
  title: string;
}

export interface TaskDisputedEvent {
  taskId: string;
  posterId: string;
  doerId: string | null;
  byUserId: string;
  title: string;
}

export interface MessageSentEvent {
  taskId: string;
  senderId: string;
  recipientId: string;
  preview: string;
}

export interface KycReviewedEvent {
  userId: string;
  approved: boolean;
  tier?: 'BRONZE' | 'SILVER' | 'GOLD';
  note?: string;
}

export interface RatingReceivedEvent {
  rateeId: string;
  raterId: string;
  taskId: string;
  score: number;
}

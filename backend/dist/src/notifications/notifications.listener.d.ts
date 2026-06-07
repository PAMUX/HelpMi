import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { type TaskPostedEvent, type TaskAcceptedEvent, type TaskCompletedEvent, type TaskConfirmedEvent, type PaymentReleasedEvent, type TaskCancelledEvent, type TaskDisputedEvent, type MessageSentEvent, type KycReviewedEvent, type RatingReceivedEvent } from './events/notification-events.js';
export declare class NotificationsListener {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    onTaskPosted(e: TaskPostedEvent): Promise<void>;
    onTaskAccepted(e: TaskAcceptedEvent): Promise<void>;
    onTaskCompleted(e: TaskCompletedEvent): Promise<void>;
    onTaskConfirmed(e: TaskConfirmedEvent): Promise<void>;
    onPaymentReleased(e: PaymentReleasedEvent): Promise<void>;
    onTaskCancelled(e: TaskCancelledEvent): Promise<void>;
    onTaskDisputed(e: TaskDisputedEvent): Promise<void>;
    onMessageSent(e: MessageSentEvent): Promise<void>;
    onKycReviewed(e: KycReviewedEvent): Promise<void>;
    onRatingReceived(e: RatingReceivedEvent): Promise<void>;
    private tiersAtOrAbove;
}

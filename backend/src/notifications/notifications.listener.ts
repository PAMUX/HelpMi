import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DoerTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import {
  NotificationEvent,
  type TaskPostedEvent,
  type TaskAcceptedEvent,
  type TaskCompletedEvent,
  type TaskConfirmedEvent,
  type PaymentReleasedEvent,
  type TaskCancelledEvent,
  type TaskDisputedEvent,
  type MessageSentEvent,
  type KycReviewedEvent,
  type RatingReceivedEvent,
} from './events/notification-events.js';

const TIER_RANK: Record<DoerTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2 };

/**
 * P2-A: the single consumer of domain events. Each handler persists (and pushes)
 * a notification. Handlers are async and isolated from the emitting transaction
 * — an error here is logged inside NotificationsService and never propagates.
 */
@Injectable()
export class NotificationsListener {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @OnEvent(NotificationEvent.TASK_POSTED)
  async onTaskPosted(e: TaskPostedEvent) {
    // Notify approved, non-banned doers whose tier qualifies for the task.
    // (Geo radius targeting is deferred — needs doer-location storage / FCM
    // topics; for launch scale a tier-filtered fan-out is acceptable.)
    const eligibleTiers = this.tiersAtOrAbove(e.requiredTier);
    const profiles = await this.prisma.doerProfile.findMany({
      where: {
        kycStatus: 'APPROVED',
        tier: { in: eligibleTiers },
        user: { isBanned: false, id: { not: e.posterId } },
      },
      select: { userId: true },
      take: 500,
    });
    await this.notifications.sendToMany(
      profiles.map((p) => p.userId),
      'TASK_POSTED',
      'New task nearby',
      e.title,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.TASK_ACCEPTED)
  async onTaskAccepted(e: TaskAcceptedEvent) {
    await this.notifications.send(
      e.posterId,
      'TASK_ACCEPTED',
      'Task accepted',
      `A doer accepted "${e.title}"`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.TASK_COMPLETED)
  async onTaskCompleted(e: TaskCompletedEvent) {
    await this.notifications.send(
      e.posterId,
      'TASK_COMPLETED',
      'Task completed',
      `The doer marked "${e.title}" complete. Please confirm.`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.TASK_CONFIRMED)
  async onTaskConfirmed(e: TaskConfirmedEvent) {
    if (!e.doerId) return;
    await this.notifications.send(
      e.doerId,
      'TASK_CONFIRMED',
      'Task confirmed',
      `The poster confirmed "${e.title}".`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.PAYMENT_RELEASED)
  async onPaymentReleased(e: PaymentReleasedEvent) {
    if (!e.doerId) return;
    await this.notifications.send(
      e.doerId,
      'PAYMENT_RELEASED',
      'Payment released',
      `Rs. ${e.amount.toFixed(2)} has been released to you${e.auto ? ' (auto-released after 24h)' : ''}.`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.TASK_CANCELLED)
  async onTaskCancelled(e: TaskCancelledEvent) {
    const recipients = [e.posterId, e.doerId].filter(
      (id): id is string => !!id && id !== e.byUserId,
    );
    await this.notifications.sendToMany(
      recipients,
      'TASK_CANCELLED',
      'Task cancelled',
      `"${e.title}" was cancelled.`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.TASK_DISPUTED)
  async onTaskDisputed(e: TaskDisputedEvent) {
    const recipients = [e.posterId, e.doerId].filter(
      (id): id is string => !!id && id !== e.byUserId,
    );
    await this.notifications.sendToMany(
      recipients,
      'TASK_DISPUTED',
      'Task disputed',
      `A dispute was raised on "${e.title}".`,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.MESSAGE_SENT)
  async onMessageSent(e: MessageSentEvent) {
    await this.notifications.send(
      e.recipientId,
      'NEW_MESSAGE',
      'New message',
      e.preview,
      e.taskId,
    );
  }

  @OnEvent(NotificationEvent.KYC_REVIEWED)
  async onKycReviewed(e: KycReviewedEvent) {
    if (e.approved) {
      await this.notifications.send(
        e.userId,
        'KYC_APPROVED',
        'Verification approved',
        `You are now a verified ${e.tier ?? 'BRONZE'} doer.`,
      );
    } else {
      await this.notifications.send(
        e.userId,
        'KYC_REJECTED',
        'Verification rejected',
        e.note ? `Reason: ${e.note}` : 'Your KYC submission was rejected.',
      );
    }
  }

  @OnEvent(NotificationEvent.RATING_RECEIVED)
  async onRatingReceived(e: RatingReceivedEvent) {
    await this.notifications.send(
      e.rateeId,
      'RATING_RECEIVED',
      'New rating',
      `You received a ${e.score}-star rating.`,
      e.taskId,
    );
  }

  private tiersAtOrAbove(required: DoerTier): DoerTier[] {
    const min = TIER_RANK[required];
    return (['BRONZE', 'SILVER', 'GOLD'] as DoerTier[]).filter((t) => TIER_RANK[t] >= min);
  }
}

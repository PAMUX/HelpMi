export declare const NotificationEvent: {
    readonly TASK_POSTED: "task.posted";
    readonly TASK_ACCEPTED: "task.accepted";
    readonly TASK_COMPLETED: "task.completed";
    readonly TASK_CONFIRMED: "task.confirmed";
    readonly PAYMENT_RELEASED: "payment.released";
    readonly TASK_CANCELLED: "task.cancelled";
    readonly TASK_DISPUTED: "task.disputed";
    readonly MESSAGE_SENT: "message.sent";
    readonly KYC_REVIEWED: "kyc.reviewed";
    readonly RATING_RECEIVED: "rating.received";
};
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

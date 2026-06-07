"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const notifications_service_js_1 = require("./notifications.service.js");
const notification_events_js_1 = require("./events/notification-events.js");
const TIER_RANK = { BRONZE: 0, SILVER: 1, GOLD: 2 };
let NotificationsListener = class NotificationsListener {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async onTaskPosted(e) {
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
        await this.notifications.sendToMany(profiles.map((p) => p.userId), 'TASK_POSTED', 'New task nearby', e.title, e.taskId);
    }
    async onTaskAccepted(e) {
        await this.notifications.send(e.posterId, 'TASK_ACCEPTED', 'Task accepted', `A doer accepted "${e.title}"`, e.taskId);
    }
    async onTaskCompleted(e) {
        await this.notifications.send(e.posterId, 'TASK_COMPLETED', 'Task completed', `The doer marked "${e.title}" complete. Please confirm.`, e.taskId);
    }
    async onTaskConfirmed(e) {
        if (!e.doerId)
            return;
        await this.notifications.send(e.doerId, 'TASK_CONFIRMED', 'Task confirmed', `The poster confirmed "${e.title}".`, e.taskId);
    }
    async onPaymentReleased(e) {
        if (!e.doerId)
            return;
        await this.notifications.send(e.doerId, 'PAYMENT_RELEASED', 'Payment released', `Rs. ${e.amount.toFixed(2)} has been released to you${e.auto ? ' (auto-released after 24h)' : ''}.`, e.taskId);
    }
    async onTaskCancelled(e) {
        const recipients = [e.posterId, e.doerId].filter((id) => !!id && id !== e.byUserId);
        await this.notifications.sendToMany(recipients, 'TASK_CANCELLED', 'Task cancelled', `"${e.title}" was cancelled.`, e.taskId);
    }
    async onTaskDisputed(e) {
        const recipients = [e.posterId, e.doerId].filter((id) => !!id && id !== e.byUserId);
        await this.notifications.sendToMany(recipients, 'TASK_DISPUTED', 'Task disputed', `A dispute was raised on "${e.title}".`, e.taskId);
    }
    async onMessageSent(e) {
        await this.notifications.send(e.recipientId, 'NEW_MESSAGE', 'New message', e.preview, e.taskId);
    }
    async onKycReviewed(e) {
        if (e.approved) {
            await this.notifications.send(e.userId, 'KYC_APPROVED', 'Verification approved', `You are now a verified ${e.tier ?? 'BRONZE'} doer.`);
        }
        else {
            await this.notifications.send(e.userId, 'KYC_REJECTED', 'Verification rejected', e.note ? `Reason: ${e.note}` : 'Your KYC submission was rejected.');
        }
    }
    async onRatingReceived(e) {
        await this.notifications.send(e.rateeId, 'RATING_RECEIVED', 'New rating', `You received a ${e.score}-star rating.`, e.taskId);
    }
    tiersAtOrAbove(required) {
        const min = TIER_RANK[required];
        return ['BRONZE', 'SILVER', 'GOLD'].filter((t) => TIER_RANK[t] >= min);
    }
};
exports.NotificationsListener = NotificationsListener;
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_POSTED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskPosted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_ACCEPTED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskAccepted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_COMPLETED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskCompleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_CONFIRMED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskConfirmed", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.PAYMENT_RELEASED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onPaymentReleased", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_CANCELLED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskCancelled", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.TASK_DISPUTED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onTaskDisputed", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.MESSAGE_SENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onMessageSent", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.KYC_REVIEWED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onKycReviewed", null);
__decorate([
    (0, event_emitter_1.OnEvent)(notification_events_js_1.NotificationEvent.RATING_RECEIVED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsListener.prototype, "onRatingReceived", null);
exports.NotificationsListener = NotificationsListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        notifications_service_js_1.NotificationsService])
], NotificationsListener);
//# sourceMappingURL=notifications.listener.js.map
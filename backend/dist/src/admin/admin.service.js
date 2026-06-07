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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const notification_events_js_1 = require("../notifications/events/notification-events.js");
const payout_service_js_1 = require("../payments/payout.service.js");
let AdminService = class AdminService {
    prisma;
    events;
    payouts;
    constructor(prisma, events, payouts) {
        this.prisma = prisma;
        this.events = events;
        this.payouts = payouts;
    }
    getPendingKyc() {
        return this.prisma.doerProfile.findMany({
            where: { kycStatus: 'PENDING' },
            include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
            orderBy: { createdAt: 'asc' },
        });
    }
    async approveKyc(profileId, adminPhone, tier = 'BRONZE') {
        const profile = await this.prisma.doerProfile.findUnique({ where: { id: profileId } });
        if (!profile)
            throw new common_1.NotFoundException('Doer profile not found');
        const updated = await this.prisma.doerProfile.update({
            where: { id: profileId },
            data: { kycStatus: 'APPROVED', tier, kycReviewedAt: new Date() },
        });
        await this.prisma.kycReview.create({
            data: { doerProfileId: profileId, reviewerPhone: adminPhone, action: 'APPROVED' },
        });
        this.events.emit(notification_events_js_1.NotificationEvent.KYC_REVIEWED, {
            userId: profile.userId,
            approved: true,
            tier,
        });
        return updated;
    }
    async rejectKyc(profileId, adminPhone, note) {
        const profile = await this.prisma.doerProfile.findUnique({ where: { id: profileId } });
        if (!profile)
            throw new common_1.NotFoundException('Doer profile not found');
        const updated = await this.prisma.doerProfile.update({
            where: { id: profileId },
            data: { kycStatus: 'REJECTED', kycReviewedAt: new Date(), kycReviewNote: note },
        });
        await this.prisma.kycReview.create({
            data: { doerProfileId: profileId, reviewerPhone: adminPhone, action: 'REJECTED', note },
        });
        this.events.emit(notification_events_js_1.NotificationEvent.KYC_REVIEWED, {
            userId: profile.userId,
            approved: false,
            note,
        });
        return updated;
    }
    getUsers(page = 1, limit = 50) {
        return this.prisma.user.findMany({
            include: { doerProfile: { select: { tier: true, kycStatus: true, totalJobsCompleted: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }
    async banUser(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
    }
    async unbanUser(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
    }
    getDisputes(status) {
        return this.prisma.dispute.findMany({
            where: status ? { status } : undefined,
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        budget: true,
                        poster: { select: { id: true, name: true, phone: true } },
                        doer: { select: { id: true, name: true, phone: true } },
                    },
                },
                raisedBy: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async resolveDispute(disputeId, adminPhone, resolutionNote, refundPoster) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
            include: { task: { include: { escrow: true } } },
        });
        if (!dispute)
            throw new common_1.NotFoundException('Dispute not found');
        await this.prisma.$transaction(async (tx) => {
            await tx.dispute.update({
                where: { id: disputeId },
                data: {
                    status: 'RESOLVED',
                    resolutionNote,
                    resolvedByPhone: adminPhone,
                    resolvedAt: new Date(),
                },
            });
            if (dispute.task.escrow) {
                await tx.escrow.update({
                    where: { taskId: dispute.taskId },
                    data: {
                        status: refundPoster ? 'REFUNDED' : 'RELEASED',
                        ...(refundPoster ? { refundedAt: new Date() } : { releasedAt: new Date() }),
                    },
                });
            }
            await tx.task.update({
                where: { id: dispute.taskId },
                data: { status: 'COMPLETED' },
            });
        });
        return { resolved: true };
    }
    listPayouts(status) {
        return this.payouts.adminList(status);
    }
    markPayoutPaid(payoutId, providerRef) {
        return this.payouts.markPaid(payoutId, providerRef);
    }
    exportPayoutsCsv(status) {
        return this.payouts.exportCsv(status);
    }
    async getStats() {
        const [users, tasks, completedTasks, openDisputes, totalEscrowHeld] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.task.count(),
            this.prisma.task.count({ where: { status: 'COMPLETED' } }),
            this.prisma.dispute.count({ where: { status: 'OPEN' } }),
            this.prisma.escrow.aggregate({
                where: { status: 'HELD' },
                _sum: { taskBudget: true },
            }),
        ]);
        return {
            users,
            tasks,
            completedTasks,
            openDisputes,
            escrowHeldLkr: totalEscrowHeld._sum.taskBudget ?? 0,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        event_emitter_1.EventEmitter2,
        payout_service_js_1.PayoutService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
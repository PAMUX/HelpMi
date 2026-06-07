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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const push_provider_js_1 = require("./providers/push.provider.js");
let NotificationsService = class NotificationsService {
    prisma;
    push;
    logger = new common_1.Logger('NotificationsService');
    constructor(prisma, push) {
        this.prisma = prisma;
        this.push = push;
    }
    async getForUser(userId) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async markRead(id, userId) {
        return this.prisma.notification.updateMany({
            where: { id, userId },
            data: { readAt: new Date() },
        });
    }
    async markAllRead(userId) {
        return this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
    }
    async getUnreadCount(userId) {
        const count = await this.prisma.notification.count({
            where: { userId, readAt: null },
        });
        return { unreadCount: count };
    }
    async send(userId, type, title, body, taskId, data) {
        try {
            const notification = await this.prisma.notification.create({
                data: { userId, type, title, body, taskId, data: data },
            });
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { fcmToken: true },
            });
            if (user?.fcmToken) {
                await this.push.sendToToken(user.fcmToken, {
                    title,
                    body,
                    data: { type, ...(taskId ? { taskId } : {}) },
                });
            }
            return notification;
        }
        catch (err) {
            this.logger.error(`Failed to send notification to ${userId}: ${err.message}`);
            return null;
        }
    }
    async sendToMany(userIds, type, title, body, taskId, data) {
        await Promise.all(userIds.map((id) => this.send(id, type, title, body, taskId, data)));
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(push_provider_js_1.PUSH_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService, Object])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map
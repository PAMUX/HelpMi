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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const notification_events_js_1 = require("../notifications/events/notification-events.js");
let MessagesService = class MessagesService {
    prisma;
    events;
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async getMessages(taskId, userId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.posterId !== userId && task.doerId !== userId) {
            throw new common_1.ForbiddenException('Not a participant of this task');
        }
        await this.prisma.message.updateMany({
            where: { taskId, senderId: { not: userId }, readAt: null },
            data: { readAt: new Date() },
        });
        return this.prisma.message.findMany({
            where: { taskId },
            include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
        });
    }
    async sendMessage(taskId, senderId, dto) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.posterId !== senderId && task.doerId !== senderId) {
            throw new common_1.ForbiddenException('Not a participant of this task');
        }
        if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
            throw new common_1.ForbiddenException('Cannot send messages on a closed task');
        }
        const message = await this.prisma.message.create({
            data: {
                taskId,
                senderId,
                content: dto.content,
                type: dto.type ?? 'TEXT',
            },
            include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
        });
        const recipientId = task.posterId === senderId ? task.doerId : task.posterId;
        if (recipientId) {
            this.events.emit(notification_events_js_1.NotificationEvent.MESSAGE_SENT, {
                taskId,
                senderId,
                recipientId,
                preview: dto.content.slice(0, 80),
            });
        }
        return message;
    }
    async getUnreadCount(userId) {
        const count = await this.prisma.message.count({
            where: {
                readAt: null,
                senderId: { not: userId },
                task: {
                    OR: [{ posterId: userId }, { doerId: userId }],
                },
            },
        });
        return { unreadCount: count };
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        event_emitter_1.EventEmitter2])
], MessagesService);
//# sourceMappingURL=messages.service.js.map
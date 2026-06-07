import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
import { type PushProvider } from './providers/push.provider.js';
export declare class NotificationsService {
    private prisma;
    private push;
    private readonly logger;
    constructor(prisma: PrismaService, push: PushProvider);
    getForUser(userId: string): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        data: import("@prisma/client/runtime/client").JsonValue | null;
        userId: string;
        taskId: string | null;
        readAt: Date | null;
        body: string;
    }[]>;
    markRead(id: string, userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markAllRead(userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    getUnreadCount(userId: string): Promise<{
        unreadCount: number;
    }>;
    send(userId: string, type: NotificationType, title: string, body: string, taskId?: string, data?: object): Promise<{
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        data: import("@prisma/client/runtime/client").JsonValue | null;
        userId: string;
        taskId: string | null;
        readAt: Date | null;
        body: string;
    } | null>;
    sendToMany(userIds: string[], type: NotificationType, title: string, body: string, taskId?: string, data?: object): Promise<void>;
}

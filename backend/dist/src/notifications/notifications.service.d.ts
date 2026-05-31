import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
export declare class NotificationsService {
    private prisma;
    constructor(prisma: PrismaService);
    getForUser(userId: string): Promise<{
        id: string;
        createdAt: Date;
        data: import("@prisma/client/runtime/client").JsonValue | null;
        userId: string;
        taskId: string | null;
        title: string;
        type: import("@prisma/client").$Enums.NotificationType;
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
        data: import("@prisma/client/runtime/client").JsonValue | null;
        userId: string;
        taskId: string | null;
        title: string;
        type: import("@prisma/client").$Enums.NotificationType;
        readAt: Date | null;
        body: string;
    }>;
}

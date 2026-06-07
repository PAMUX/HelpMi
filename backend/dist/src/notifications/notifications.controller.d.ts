import { NotificationsService } from './notifications.service.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class NotificationsController {
    private notifications;
    constructor(notifications: NotificationsService);
    getAll(user: JwtPayload): Promise<{
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
    getUnreadCount(user: JwtPayload): Promise<{
        unreadCount: number;
    }>;
    markAllRead(user: JwtPayload): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markRead(id: string, user: JwtPayload): Promise<import("@prisma/client").Prisma.BatchPayload>;
}

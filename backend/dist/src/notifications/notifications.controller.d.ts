import { NotificationsService } from './notifications.service.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class NotificationsController {
    private notifications;
    constructor(notifications: NotificationsService);
    getAll(user: JwtPayload): Promise<{
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
    getUnreadCount(user: JwtPayload): Promise<{
        unreadCount: number;
    }>;
    markAllRead(user: JwtPayload): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markRead(id: string, user: JwtPayload): Promise<import("@prisma/client").Prisma.BatchPayload>;
}

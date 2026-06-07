import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class MessagesController {
    private messages;
    constructor(messages: MessagesService);
    getUnreadCount(user: JwtPayload): Promise<{
        unreadCount: number;
    }>;
    getMessages(taskId: string, user: JwtPayload): Promise<({
        sender: {
            id: string;
            name: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.MessageType;
        content: string;
        taskId: string;
        readAt: Date | null;
        senderId: string;
    })[]>;
    sendMessage(taskId: string, user: JwtPayload, dto: SendMessageDto): Promise<{
        sender: {
            id: string;
            name: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.MessageType;
        content: string;
        taskId: string;
        readAt: Date | null;
        senderId: string;
    }>;
}

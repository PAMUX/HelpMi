import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
export declare class MessagesService {
    private prisma;
    constructor(prisma: PrismaService);
    getMessages(taskId: string, userId: string): Promise<({
        sender: {
            id: string;
            name: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        taskId: string;
        content: string;
        type: import("@prisma/client").$Enums.MessageType;
        readAt: Date | null;
        senderId: string;
    })[]>;
    sendMessage(taskId: string, senderId: string, dto: SendMessageDto): Promise<{
        sender: {
            id: string;
            name: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        taskId: string;
        content: string;
        type: import("@prisma/client").$Enums.MessageType;
        readAt: Date | null;
        senderId: string;
    }>;
    getUnreadCount(userId: string): Promise<{
        unreadCount: number;
    }>;
}

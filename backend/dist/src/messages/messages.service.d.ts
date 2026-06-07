import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
export declare class MessagesService {
    private prisma;
    private events;
    constructor(prisma: PrismaService, events: EventEmitter2);
    getMessages(taskId: string, userId: string): Promise<({
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
    sendMessage(taskId: string, senderId: string, dto: SendMessageDto): Promise<{
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
    getUnreadCount(userId: string): Promise<{
        unreadCount: number;
    }>;
}

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
export declare class RatingsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(raterId: string, dto: CreateRatingDto): Promise<{
        id: string;
        createdAt: Date;
        taskId: string;
        raterId: string;
        rateeId: string;
        score: number;
        comment: string | null;
        isOnTime: boolean | null;
    }>;
    getForUser(userId: string): Promise<{
        ratings: ({
            task: {
                category: {
                    nameEn: string;
                };
                title: string;
            };
            rater: {
                id: string;
                name: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            taskId: string;
            raterId: string;
            rateeId: string;
            score: number;
            comment: string | null;
            isOnTime: boolean | null;
        })[];
        summary: {
            total: number;
            average: number;
            onTimeRate: number;
        };
    }>;
    private updateDoerStats;
}

import { RatingsService } from './ratings.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class RatingsController {
    private ratings;
    constructor(ratings: RatingsService);
    create(user: JwtPayload, dto: CreateRatingDto): Promise<{
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
}

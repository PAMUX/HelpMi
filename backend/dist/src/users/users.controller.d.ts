import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class UsersController {
    private users;
    constructor(users: UsersService);
    getMe(user: JwtPayload): Promise<{
        doerProfile: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            tier: import("@prisma/client").$Enums.DoerTier;
            kycStatus: import("@prisma/client").$Enums.KycStatus;
            nicPhotoUrl: string | null;
            selfieUrl: string | null;
            addressProofUrl: string | null;
            policeClearanceUrl: string | null;
            drivingLicenseUrl: string | null;
            skillProofUrl: string | null;
            ref1Name: string | null;
            ref1Phone: string | null;
            ref2Name: string | null;
            ref2Phone: string | null;
            totalJobsCompleted: number;
            avgRating: number;
            onTimeRate: number;
            kycReviewedAt: Date | null;
            kycReviewNote: string | null;
        } | null;
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        name: string | null;
        phone: string;
        email: string | null;
        avatarUrl: string | null;
        isDoer: boolean;
        isPoster: boolean;
        isBanned: boolean;
        fcmToken: string | null;
        updatedAt: Date;
    }>;
    updateMe(user: JwtPayload, dto: UpdateUserDto): Promise<{
        doerProfile: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            tier: import("@prisma/client").$Enums.DoerTier;
            kycStatus: import("@prisma/client").$Enums.KycStatus;
            nicPhotoUrl: string | null;
            selfieUrl: string | null;
            addressProofUrl: string | null;
            policeClearanceUrl: string | null;
            drivingLicenseUrl: string | null;
            skillProofUrl: string | null;
            ref1Name: string | null;
            ref1Phone: string | null;
            ref2Name: string | null;
            ref2Phone: string | null;
            totalJobsCompleted: number;
            avgRating: number;
            onTimeRate: number;
            kycReviewedAt: Date | null;
            kycReviewNote: string | null;
        } | null;
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        name: string | null;
        phone: string;
        email: string | null;
        avatarUrl: string | null;
        isDoer: boolean;
        isPoster: boolean;
        isBanned: boolean;
        fcmToken: string | null;
        updatedAt: Date;
    }>;
    getProfile(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string | null;
        doerProfile: {
            tier: import("@prisma/client").$Enums.DoerTier;
            kycStatus: import("@prisma/client").$Enums.KycStatus;
            totalJobsCompleted: number;
            avgRating: number;
            onTimeRate: number;
        } | null;
        avatarUrl: string | null;
        isDoer: boolean;
        isPoster: boolean;
        ratingsReceived: {
            createdAt: Date;
            score: number;
            comment: string | null;
            isOnTime: boolean | null;
        }[];
    }>;
}

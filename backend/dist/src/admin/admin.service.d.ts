import { PrismaService } from '../prisma/prisma.service.js';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getPendingKyc(): import("@prisma/client").Prisma.PrismaPromise<({
        user: {
            id: string;
            createdAt: Date;
            name: string | null;
            phone: string;
        };
    } & {
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
    })[]>;
    approveKyc(profileId: string, adminPhone: string, tier?: 'BRONZE' | 'SILVER' | 'GOLD'): Promise<{
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
    }>;
    rejectKyc(profileId: string, adminPhone: string, note: string): Promise<{
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
    }>;
    getUsers(page?: number, limit?: number): import("@prisma/client").Prisma.PrismaPromise<({
        doerProfile: {
            tier: import("@prisma/client").$Enums.DoerTier;
            kycStatus: import("@prisma/client").$Enums.KycStatus;
            totalJobsCompleted: number;
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
    })[]>;
    banUser(userId: string): Promise<{
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
    unbanUser(userId: string): Promise<{
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
    getDisputes(status?: 'OPEN' | 'RESOLVED' | 'CLOSED'): import("@prisma/client").Prisma.PrismaPromise<({
        task: {
            id: string;
            title: string;
            budget: import("@prisma/client-runtime-utils").Decimal;
            poster: {
                id: string;
                name: string | null;
                phone: string;
            };
            doer: {
                id: string;
                name: string | null;
                phone: string;
            } | null;
        };
        raisedBy: {
            id: string;
            name: string | null;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        taskId: string;
        status: import("@prisma/client").$Enums.DisputeStatus;
        raisedById: string;
        reason: string;
        resolutionNote: string | null;
        resolvedByPhone: string | null;
        resolvedAt: Date | null;
    })[]>;
    resolveDispute(disputeId: string, adminPhone: string, resolutionNote: string, refundPoster: boolean): Promise<{
        resolved: boolean;
    }>;
    getStats(): Promise<{
        users: number;
        tasks: number;
        completedTasks: number;
        openDisputes: number;
        escrowHeldLkr: number | import("@prisma/client-runtime-utils").Decimal;
    }>;
}

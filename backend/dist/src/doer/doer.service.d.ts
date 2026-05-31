import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';
export declare class DoerService {
    private prisma;
    constructor(prisma: PrismaService);
    getProfile(userId: string): Promise<{
        kycReviews: {
            id: string;
            createdAt: Date;
            reviewerPhone: string;
            action: import("@prisma/client").$Enums.KycStatus;
            note: string | null;
            doerProfileId: string;
        }[];
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
    }>;
    submitKyc(userId: string, dto: SubmitKycDto): Promise<{
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
    getMyTasks(userId: string): Promise<({
        category: {
            minTier: import("@prisma/client").$Enums.DoerTier;
            id: string;
            slug: string;
            nameEn: string;
            nameSi: string | null;
            nameTa: string | null;
            iconUrl: string | null;
            isActive: boolean;
            sortOrder: number;
            createdAt: Date;
        };
        poster: {
            id: string;
            name: string | null;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        posterId: string;
        categoryId: string;
        title: string;
        description: string;
        photoUrls: string[];
        locationLat: number;
        locationLng: number;
        locationAddress: string;
        budget: import("@prisma/client-runtime-utils").Decimal;
        paymentMode: import("@prisma/client").$Enums.PaymentMode;
        requiredTier: import("@prisma/client").$Enums.DoerTier;
        status: import("@prisma/client").$Enums.TaskStatus;
        scheduledStart: Date | null;
        scheduledEnd: Date | null;
        doerId: string | null;
        acceptedAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        completionPhotoUrl: string | null;
        confirmedAt: Date | null;
        isFeatured: boolean;
    })[]>;
}

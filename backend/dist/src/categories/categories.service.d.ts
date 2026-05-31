import { PrismaService } from '../prisma/prisma.service.js';
export declare class CategoriesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
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
    }[]>;
}

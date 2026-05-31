import { CategoriesService } from './categories.service.js';
export declare class CategoriesController {
    private categories;
    constructor(categories: CategoriesService);
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

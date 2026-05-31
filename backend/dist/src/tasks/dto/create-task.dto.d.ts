export declare class CreateTaskDto {
    categoryId: string;
    title: string;
    description: string;
    photoUrls?: string[];
    locationLat: number;
    locationLng: number;
    locationAddress: string;
    budget: number;
    paymentMode?: 'ESCROW' | 'CASH';
    requiredTier?: 'BRONZE' | 'SILVER' | 'GOLD';
    scheduledStart?: string;
    scheduledEnd?: string;
}

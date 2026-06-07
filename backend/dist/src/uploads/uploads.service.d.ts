import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider.js';
import { PresignDto } from './dto/presign.dto.js';
export interface PresignResult {
    uploadUrl: string;
    key: string;
    fileUrl: string | null;
    isPrivate: boolean;
    expiresAt: string;
}
export declare class UploadsService {
    private storage;
    private config;
    constructor(storage: StorageProvider, config: ConfigService);
    presign(userId: string, dto: PresignDto): Promise<PresignResult>;
    presignRead(key: string): Promise<{
        url: string;
        expiresAt: string;
    }>;
}

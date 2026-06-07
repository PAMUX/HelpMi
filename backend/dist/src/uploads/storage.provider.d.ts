import { ConfigService } from '@nestjs/config';
export declare class StorageProvider {
    private config;
    private readonly logger;
    private client;
    constructor(config: ConfigService);
    private getClient;
    bucketFor(isPrivate: boolean): string;
    presignPut(bucket: string, key: string, contentType: string, expiresInSeconds: number): Promise<string>;
    presignGet(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
    publicUrl(bucket: string, key: string): string;
}

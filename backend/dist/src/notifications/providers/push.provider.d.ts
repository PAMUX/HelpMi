import { ConfigService } from '@nestjs/config';
export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}
export interface PushProvider {
    sendToToken(token: string, payload: PushPayload): Promise<void>;
}
export declare const PUSH_PROVIDER = "PUSH_PROVIDER";
export declare class ConsolePushProvider implements PushProvider {
    private readonly logger;
    sendToToken(token: string, payload: PushPayload): Promise<void>;
}
export declare class FcmPushProvider implements PushProvider {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    sendToToken(token: string, payload: PushPayload): Promise<void>;
    private getAccessToken;
}
export declare const pushProviderFactory: {
    provide: string;
    inject: (typeof ConfigService)[];
    useFactory: (config: ConfigService) => PushProvider;
};

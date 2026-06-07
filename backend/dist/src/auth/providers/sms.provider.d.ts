import { ConfigService } from '@nestjs/config';
export interface SmsProvider {
    sendOtp(phone: string, code: string): Promise<void>;
}
export declare const SMS_PROVIDER = "SMS_PROVIDER";
export declare class ConsoleSmsProvider implements SmsProvider {
    private readonly logger;
    sendOtp(phone: string, code: string): Promise<void>;
}
export declare class DialogSmsProvider implements SmsProvider {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    sendOtp(phone: string, code: string): Promise<void>;
}
export declare class TwilioSmsProvider implements SmsProvider {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    sendOtp(phone: string, code: string): Promise<void>;
}
export declare const smsProviderFactory: {
    provide: string;
    inject: (typeof ConfigService)[];
    useFactory: (config: ConfigService) => SmsProvider;
};

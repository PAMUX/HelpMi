import { ConfigService } from '@nestjs/config';
import { PayoutMethod } from '@prisma/client';
export interface PayoutDispatchInput {
    payoutId: string;
    amount: number;
    method: PayoutMethod;
    destination: Record<string, unknown> | null;
}
export interface PayoutDispatchResult {
    status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
    providerRef?: string;
    failureReason?: string;
}
export declare class PayoutProvider {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    dispatch(input: PayoutDispatchInput): Promise<PayoutDispatchResult>;
    private dispatchWallet;
}

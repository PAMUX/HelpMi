import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayoutMethod } from '@prisma/client';

/**
 * P3-A: payout dispatch abstraction.
 * - Wallet (eZ Cash / FriMi) payouts are automated via PayHere's payout API.
 * - Bank (CEFTS/SLIPS) payouts are settled by a manual admin CSV batch, so the
 *   provider leaves them PENDING for an admin to mark paid.
 */
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

@Injectable()
export class PayoutProvider {
  private readonly logger = new Logger('PayoutProvider');

  constructor(private config: ConfigService) {}

  async dispatch(input: PayoutDispatchInput): Promise<PayoutDispatchResult> {
    if (input.method === 'BANK') {
      // Manual batch: nothing to call; an admin reconciles via CSV export.
      return { status: 'PENDING' };
    }
    return this.dispatchWallet(input);
  }

  /**
   * Wallet payout via PayHere payout API. Network call is a marked integration
   * point; until credentials are configured it queues as PROCESSING so the
   * ledger stays consistent and an admin/job can reconcile.
   */
  private async dispatchWallet(input: PayoutDispatchInput): Promise<PayoutDispatchResult> {
    const apiKey = this.config.get<string>('PAYHERE_PAYOUT_API_KEY');
    if (!apiKey) {
      this.logger.warn('PAYHERE_PAYOUT_API_KEY not set; wallet payout queued (PROCESSING)');
      return { status: 'PROCESSING' };
    }
    try {
      // INTEGRATION POINT: call PayHere payout endpoint here.
      // const res = await fetch('https://www.payhere.lk/merchant/v1/payment/payout', {...})
      return { status: 'PROCESSING', providerRef: `wallet-${input.payoutId}` };
    } catch (err) {
      this.logger.error(`Wallet payout failed: ${(err as Error).message}`);
      return { status: 'FAILED', failureReason: (err as Error).message };
    }
  }
}

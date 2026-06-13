import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * G-1: PayHere Merchant API client (OAuth2 client-credentials).
 *
 * Entirely env-driven so sandbox → live needs configuration only, never a
 * code change (Sprint-2 decision #6):
 *   PAYHERE_APP_ID / PAYHERE_APP_SECRET — Business App credentials
 *   PAYHERE_MODE — sandbox | live (selects the API host)
 *
 * When credentials are absent, isConfigured() is false and RefundService
 * queues refunds as PENDING for the reconcile sweep / admin retry — the same
 * graceful-degradation pattern the payout provider uses.
 */
export interface PayHereRefundResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

@Injectable()
export class PayHereClient {
  private readonly logger = new Logger('PayHereClient');
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>('PAYHERE_APP_ID') && this.config.get<string>('PAYHERE_APP_SECRET')
    );
  }

  private baseUrl(): string {
    const mode = (this.config.get<string>('PAYHERE_MODE') ?? 'sandbox').toLowerCase();
    return mode === 'live' ? 'https://www.payhere.lk' : 'https://sandbox.payhere.lk';
  }

  /** OAuth token, cached until shortly before expiry. */
  private async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }
    const appId = this.config.get<string>('PAYHERE_APP_ID') ?? '';
    const appSecret = this.config.get<string>('PAYHERE_APP_SECRET') ?? '';
    const res = await fetch(`${this.baseUrl()}/merchant/v1/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) {
      throw new Error(`PayHere token endpoint returned ${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number | string };
    if (!data.access_token) {
      throw new Error('PayHere token endpoint returned no access_token');
    }
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 600) * 1000,
    };
    return this.token.value;
  }

  /**
   * Full refund of a captured payment. PayHere replies { status: 1 } on
   * success; anything else (or a transport error) is a clean failure result —
   * this method never throws, so callers can persist the outcome verbatim.
   */
  async refundPayment(paymentId: string, description: string): Promise<PayHereRefundResult> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.baseUrl()}/merchant/v1/payment/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_id: paymentId, description }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: number | string;
        msg?: string;
        data?: { refund_id?: number | string; id?: number | string } | null;
      };
      if (res.ok && Number(data.status) === 1) {
        const ref = data.data?.refund_id ?? data.data?.id;
        return { success: true, providerRef: ref !== undefined ? String(ref) : undefined };
      }
      const error = data.msg ? String(data.msg) : `PayHere refund returned HTTP ${res.status}`;
      this.logger.warn(`Refund failed for payment ${paymentId}: ${error}`);
      return { success: false, error };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(`Refund call error for payment ${paymentId}: ${error}`);
      return { success: false, error };
    }
  }
}

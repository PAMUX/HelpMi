import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * P2-B: pluggable SMS delivery. AuthService depends only on this interface and
 * the SMS_PROVIDER token, never on a concrete gateway.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

const otpMessage = (code: string) =>
  `Your HelpMi verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`;

/** Development/default provider — logs the OTP instead of sending it. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('ConsoleSmsProvider');

  sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[SMS→${phone}] ${otpMessage(code)}`);
    return Promise.resolve();
  }
}

/**
 * Production provider for Dialog/Mobitel-style HTTP SMS gateways. Endpoint and
 * auth are env-driven so the same class serves most Sri Lankan gateways. Throws
 * on failure so AuthService can surface a clean 5xx (the OTP code is never
 * leaked to the client).
 */
@Injectable()
export class DialogSmsProvider implements SmsProvider {
  private readonly logger = new Logger('DialogSmsProvider');

  constructor(private config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const url = this.config.get<string>('SMS_GATEWAY_URL');
    const apiKey = this.config.get<string>('SMS_GATEWAY_API_KEY');
    const sender = this.config.get<string>('SMS_SENDER_ID') ?? 'HelpMi';
    if (!url || !apiKey) {
      throw new Error('SMS gateway not configured (SMS_GATEWAY_URL / SMS_GATEWAY_API_KEY)');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Field names follow the common Dialog/Mobitel REST shape; adjust per the
        // exact gateway contract during integration.
        msisdn: phone,
        message: otpMessage(code),
        sourceAddress: sender,
      }),
    });

    if (!res.ok) {
      this.logger.error(`SMS gateway error ${res.status}: ${await res.text()}`);
      throw new Error(`SMS gateway returned ${res.status}`);
    }
  }
}

/**
 * Production provider for Twilio. Uses Basic auth (Account SID + Auth Token)
 * against the Messages API.
 */
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger('TwilioSmsProvider');

  constructor(private config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)');
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: otpMessage(code) }),
    });

    if (!res.ok) {
      this.logger.error(`Twilio error ${res.status}: ${await res.text()}`);
      throw new Error(`Twilio returned ${res.status}`);
    }
  }
}

/** Factory: pick the provider by SMS_PROVIDER env (console | dialog | twilio). */
export const smsProviderFactory = {
  provide: SMS_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): SmsProvider => {
    const kind = (config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
    if (kind === 'dialog') return new DialogSmsProvider(config);
    if (kind === 'twilio') return new TwilioSmsProvider(config);
    return new ConsoleSmsProvider();
  },
};

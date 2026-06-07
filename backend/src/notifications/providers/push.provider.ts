import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * P2-A: pluggable push delivery. Business code never touches a concrete
 * provider; the NotificationsService resolves one via the PUSH_PROVIDER token.
 */
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  /** Send a push to a single device token. Must never throw to the caller. */
  sendToToken(token: string, payload: PushPayload): Promise<void>;
}

export const PUSH_PROVIDER = 'PUSH_PROVIDER';

/** Development/default provider — logs instead of sending. */
@Injectable()
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger('ConsolePushProvider');

  sendToToken(token: string, payload: PushPayload): Promise<void> {
    this.logger.log(`[PUSH→${token.slice(0, 12)}…] ${payload.title} — ${payload.body}`);
    return Promise.resolve();
  }
}

/**
 * Production FCM provider (HTTP v1). Requires a Google service account. The
 * OAuth access-token exchange is intentionally left as a single clearly-marked
 * integration point so it can be wired to `google-auth-library` without
 * touching the rest of the system. Failures are swallowed (logged) so a push
 * outage can never break a business transaction.
 */
@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger('FcmPushProvider');

  constructor(private readonly config: ConfigService) {}

  async sendToToken(token: string, payload: PushPayload): Promise<void> {
    try {
      const projectId = this.config.get<string>('FCM_PROJECT_ID');
      if (!projectId) {
        this.logger.warn('FCM_PROJECT_ID not set; skipping push');
        return;
      }
      const accessToken = await this.getAccessToken();
      if (!accessToken) return;

      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
            },
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`FCM send failed (${res.status}): ${await res.text()}`);
      }
    } catch (err) {
      this.logger.error(`FCM send error: ${(err as Error).message}`);
    }
  }

  /**
   * INTEGRATION POINT: exchange the service-account JSON for a short-lived
   * OAuth access token (scope https://www.googleapis.com/auth/firebase.messaging).
   * Recommended: `google-auth-library` GoogleAuth.getAccessToken(). Returns null
   * until configured so the provider degrades gracefully.
   */
  private getAccessToken(): Promise<string | null> {
    const saJson = this.config.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      this.logger.warn('FCM_SERVICE_ACCOUNT_JSON not set; cannot obtain access token');
      return Promise.resolve(null);
    }
    // TODO: implement OAuth2 JWT bearer exchange via google-auth-library.
    return Promise.resolve(null);
  }
}

/** Factory: pick the provider by PUSH_PROVIDER env (console | fcm). */
export const pushProviderFactory = {
  provide: PUSH_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PushProvider => {
    const kind = (config.get<string>('PUSH_PROVIDER') ?? 'console').toLowerCase();
    if (kind === 'fcm') return new FcmPushProvider(config);
    return new ConsolePushProvider();
  },
};

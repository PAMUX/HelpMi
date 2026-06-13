/**
 * G-9 (Sprint 1): runtime configuration validation.
 *
 * Wired into ConfigModule.forRoot({ validate }) so the application REFUSES to
 * boot with production-unsafe configuration. In non-production environments
 * only the bare-minimum keys are enforced, keeping local dev frictionless.
 *
 * Rules (production only, NODE_ENV=production):
 *  - JWT_SECRET: >=32 chars and not a default/weak-pattern value
 *  - OTP_PEPPER: required (server-side pepper for OTP hashes)
 *  - CORS_ORIGINS: required (never reflect arbitrary origins in prod)
 *  - APP_PUBLIC_BASE_URL: required, must be https (PayHere return/notify URLs)
 *  - SMS_PROVIDER / PUSH_PROVIDER: must not be 'console' (console logs OTPs)
 *  - PAYHERE_MODE: must be 'live' unless PAYHERE_ALLOW_SANDBOX_IN_PROD=true
 *  - PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET: real values, no "your-…"
 *  - ADMIN_PHONES: required (admin allowlist must be explicit)
 */

const WEAK_SECRET_PATTERN = /change|secret|password|example|sample|dev|test|1234/i;

export interface EnvIssue {
  key: string;
  problem: string;
}

const str = (env: Record<string, unknown>, key: string): string =>
  typeof env[key] === 'string' ? (env[key] as string).trim() : '';

/** Pure rule evaluation — returns every violation (never throws). */
export function collectEnvIssues(env: Record<string, unknown>): EnvIssue[] {
  const issues: EnvIssue[] = [];

  // Required in every environment.
  if (!str(env, 'DATABASE_URL')) issues.push({ key: 'DATABASE_URL', problem: 'is required' });
  if (!str(env, 'JWT_SECRET')) issues.push({ key: 'JWT_SECRET', problem: 'is required' });

  if (str(env, 'NODE_ENV') !== 'production') return issues;

  // Production-only hard requirements.
  const jwt = str(env, 'JWT_SECRET');
  if (jwt && (jwt.length < 32 || WEAK_SECRET_PATTERN.test(jwt))) {
    issues.push({
      key: 'JWT_SECRET',
      problem: 'must be at least 32 chars and not a default/weak-pattern value',
    });
  }

  if (!str(env, 'OTP_PEPPER')) {
    issues.push({ key: 'OTP_PEPPER', problem: 'must be set in production (OTP hash pepper)' });
  }

  if (!str(env, 'CORS_ORIGINS')) {
    issues.push({
      key: 'CORS_ORIGINS',
      problem: 'must list allowed origins in production (reflect-any is dev-only)',
    });
  }

  const base = str(env, 'APP_PUBLIC_BASE_URL');
  if (!base) {
    issues.push({
      key: 'APP_PUBLIC_BASE_URL',
      problem: 'is required in production (PayHere return/cancel/notify URLs derive from it)',
    });
  } else if (!base.startsWith('https://')) {
    issues.push({ key: 'APP_PUBLIC_BASE_URL', problem: 'must be an https:// URL in production' });
  }

  if ((str(env, 'SMS_PROVIDER') || 'console').toLowerCase() === 'console') {
    issues.push({
      key: 'SMS_PROVIDER',
      problem: "console provider writes OTPs to logs; set 'dialog' or 'twilio' in production",
    });
  }

  if ((str(env, 'PUSH_PROVIDER') || 'console').toLowerCase() === 'console') {
    issues.push({ key: 'PUSH_PROVIDER', problem: "set 'fcm' in production" });
  }

  const payhereMode = (str(env, 'PAYHERE_MODE') || 'sandbox').toLowerCase();
  if (payhereMode !== 'live' && str(env, 'PAYHERE_ALLOW_SANDBOX_IN_PROD') !== 'true') {
    issues.push({
      key: 'PAYHERE_MODE',
      problem: "must be 'live' in production (or set PAYHERE_ALLOW_SANDBOX_IN_PROD=true explicitly)",
    });
  }

  for (const key of ['PAYHERE_MERCHANT_ID', 'PAYHERE_MERCHANT_SECRET'] as const) {
    const value = str(env, key);
    if (!value || value.startsWith('your-')) {
      issues.push({ key, problem: 'must be set to real merchant credentials in production' });
    }
  }

  // G-1: Merchant-API (Business App) credentials power refunds. Without them
  // every refund queues as PENDING — unacceptable in production.
  for (const key of ['PAYHERE_APP_ID', 'PAYHERE_APP_SECRET'] as const) {
    const value = str(env, key);
    if (!value || value.startsWith('your-')) {
      issues.push({
        key,
        problem: 'must be set in production (PayHere Business App — refund execution)',
      });
    }
  }

  if (!str(env, 'ADMIN_PHONES')) {
    issues.push({ key: 'ADMIN_PHONES', problem: 'must be set in production (admin allowlist)' });
  }

  return issues;
}

/**
 * ConfigModule `validate` hook. Throws (aborting bootstrap) when any rule is
 * violated, listing every violation at once so ops can fix them in one pass.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const issues = collectEnvIssues(env);
  if (issues.length > 0) {
    const details = issues.map((i) => `  - ${i.key}: ${i.problem}`).join('\n');
    throw new Error(`Unsafe or incomplete configuration — refusing to start:\n${details}`);
  }
  return env;
}

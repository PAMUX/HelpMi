import { collectEnvIssues, validateEnv } from './env.validation';

/** G-9: the validator matrix — dev stays permissive, prod refuses unsafe boot. */
describe('env.validation (G-9)', () => {
  const devMinimum = {
    DATABASE_URL: 'postgresql://localhost:5432/helpmi',
    JWT_SECRET: 'anything-goes-in-dev',
  };

  const prodSafe = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db:5432/helpmi',
    JWT_SECRET: 'BL4teeUOeVnMDwbvfAOQmbHxNjCaJehl8qIcWgzGW',
    OTP_PEPPER: 'a-long-random-pepper-value',
    CORS_ORIGINS: 'https://app.helpmi.example',
    APP_PUBLIC_BASE_URL: 'https://api.helpmi.example',
    SMS_PROVIDER: 'dialog',
    PUSH_PROVIDER: 'fcm',
    PAYHERE_MODE: 'live',
    PAYHERE_MERCHANT_ID: '1230001',
    PAYHERE_MERCHANT_SECRET: 'MjEwNDY1OTk1NDIw',
    PAYHERE_APP_ID: '4OVxz5N9PAn4',
    PAYHERE_APP_SECRET: '8nJzkVzAGw84LDBGiNpJ8l4',
    ADMIN_PHONES: '+94770000001',
  };

  const issueKeys = (env: Record<string, unknown>) => collectEnvIssues(env).map((i) => i.key);

  it('passes with the dev minimum (no NODE_ENV=production)', () => {
    expect(collectEnvIssues(devMinimum)).toEqual([]);
    expect(() => validateEnv(devMinimum)).not.toThrow();
  });

  it('always requires DATABASE_URL and JWT_SECRET', () => {
    expect(issueKeys({})).toEqual(expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET']));
  });

  it('passes with a fully safe production config', () => {
    expect(collectEnvIssues(prodSafe)).toEqual([]);
  });

  it('rejects a weak/default-pattern JWT_SECRET in production', () => {
    expect(issueKeys({ ...prodSafe, JWT_SECRET: 'helpmi-super-secret-jwt-key-2026' })).toContain(
      'JWT_SECRET',
    );
    expect(issueKeys({ ...prodSafe, JWT_SECRET: 'short' })).toContain('JWT_SECRET');
  });

  it('requires OTP_PEPPER in production', () => {
    expect(issueKeys({ ...prodSafe, OTP_PEPPER: '' })).toContain('OTP_PEPPER');
  });

  it('requires CORS_ORIGINS in production (no reflect-any)', () => {
    expect(issueKeys({ ...prodSafe, CORS_ORIGINS: '' })).toContain('CORS_ORIGINS');
  });

  it('requires an https APP_PUBLIC_BASE_URL in production', () => {
    expect(issueKeys({ ...prodSafe, APP_PUBLIC_BASE_URL: '' })).toContain('APP_PUBLIC_BASE_URL');
    expect(issueKeys({ ...prodSafe, APP_PUBLIC_BASE_URL: 'http://api.helpmi.example' })).toContain(
      'APP_PUBLIC_BASE_URL',
    );
  });

  it('rejects console SMS/push providers in production (OTP-in-logs)', () => {
    expect(issueKeys({ ...prodSafe, SMS_PROVIDER: 'console' })).toContain('SMS_PROVIDER');
    expect(issueKeys({ ...prodSafe, SMS_PROVIDER: '' })).toContain('SMS_PROVIDER'); // default = console
    expect(issueKeys({ ...prodSafe, PUSH_PROVIDER: 'console' })).toContain('PUSH_PROVIDER');
  });

  it('rejects sandbox PayHere mode in production unless explicitly overridden', () => {
    expect(issueKeys({ ...prodSafe, PAYHERE_MODE: 'sandbox' })).toContain('PAYHERE_MODE');
    expect(
      collectEnvIssues({
        ...prodSafe,
        PAYHERE_MODE: 'sandbox',
        PAYHERE_ALLOW_SANDBOX_IN_PROD: 'true',
      }),
    ).toEqual([]);
  });

  it('rejects placeholder PayHere credentials in production', () => {
    expect(issueKeys({ ...prodSafe, PAYHERE_MERCHANT_ID: 'your-merchant-id' })).toContain(
      'PAYHERE_MERCHANT_ID',
    );
    expect(issueKeys({ ...prodSafe, PAYHERE_MERCHANT_SECRET: '' })).toContain(
      'PAYHERE_MERCHANT_SECRET',
    );
  });

  it('G-1: requires PayHere Business App (refund API) credentials in production', () => {
    expect(issueKeys({ ...prodSafe, PAYHERE_APP_ID: '' })).toContain('PAYHERE_APP_ID');
    expect(issueKeys({ ...prodSafe, PAYHERE_APP_SECRET: 'your-app-secret' })).toContain(
      'PAYHERE_APP_SECRET',
    );
  });

  it('requires ADMIN_PHONES in production', () => {
    expect(issueKeys({ ...prodSafe, ADMIN_PHONES: '' })).toContain('ADMIN_PHONES');
  });

  it('validateEnv throws one aggregated, named-key error', () => {
    expect(() => validateEnv({ ...prodSafe, OTP_PEPPER: '', CORS_ORIGINS: '' })).toThrow(
      /OTP_PEPPER[\s\S]*CORS_ORIGINS/,
    );
  });
});

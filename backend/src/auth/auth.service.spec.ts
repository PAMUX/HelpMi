import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

// P2-B: OTP issuance (cooldown + SMS), hashing, max attempts.

const hashOtp = (phone: string, code: string) =>
  createHash('sha256').update(`${phone}:${code}`).digest('hex');

function buildPrisma() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
    otpToken: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
  } as any;
}

function buildConfig(overrides: Record<string, any> = {}) {
  const values: Record<string, any> = {
    OTP_EXPIRY_MINUTES: 5,
    OTP_RESEND_COOLDOWN_SECONDS: 60,
    ...overrides,
  };
  return { get: jest.fn((k: string) => values[k]) } as any;
}

describe('AuthService OTP (P2-B)', () => {
  let prisma: any;
  let jwt: any;
  let sms: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = buildPrisma();
    jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
    sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(prisma, jwt, buildConfig(), sms);
  });

  describe('requestOtp', () => {
    it('creates a user if new, stores a HASHED code, and sends SMS', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', phone: '+94771234567', isBanned: false });
      prisma.otpToken.findFirst.mockResolvedValue(null); // no recent OTP

      await service.requestOtp({ phone: '+94771234567' } as any);

      expect(sms.sendOtp).toHaveBeenCalledWith('+94771234567', expect.stringMatching(/^\d{6}$/));
      const stored = prisma.otpToken.create.mock.calls[0][0].data.code;
      expect(stored).toHaveLength(64); // sha256 hex
      expect(stored).not.toMatch(/^\d{6}$/); // never plaintext
    });

    it('enforces the resend cooldown', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+94771234567', isBanned: false });
      prisma.otpToken.findFirst.mockResolvedValue({ id: 'recent', createdAt: new Date() });

      await expect(service.requestOtp({ phone: '+94771234567' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.otpToken.create).not.toHaveBeenCalled();
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('rejects banned users', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: '+94771234567', isBanned: true });
      await expect(service.requestOtp({ phone: '+94771234567' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('verifies a correct code against the stored hash and returns a JWT', async () => {
      prisma.otpToken.findFirst.mockResolvedValue({
        id: 'tok1', userId: 'u1', attempts: 0, code: hashOtp('+94771234567', '123456'),
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', phone: '+94771234567', isBanned: false });

      const res = await service.verifyOtp({ phone: '+94771234567', code: '123456' } as any);

      expect(res.accessToken).toBe('jwt-token');
      expect(prisma.otpToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tok1' }, data: { used: true } }),
      );
    });

    it('increments attempts and rejects a wrong code', async () => {
      prisma.otpToken.findFirst.mockResolvedValue({
        id: 'tok1', userId: 'u1', attempts: 0, code: hashOtp('+94771234567', '123456'),
      });
      await expect(
        service.verifyOtp({ phone: '+94771234567', code: '000000' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.otpToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
    });

    it('locks the token after max attempts', async () => {
      prisma.otpToken.findFirst.mockResolvedValue({
        id: 'tok1', userId: 'u1', attempts: 5, code: hashOtp('+94771234567', '123456'),
      });
      await expect(
        service.verifyOtp({ phone: '+94771234567', code: '123456' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.otpToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { used: true } }),
      );
    });

    it('rejects when no active token exists', async () => {
      prisma.otpToken.findFirst.mockResolvedValue(null);
      await expect(
        service.verifyOtp({ phone: '+94771234567', code: '123456' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

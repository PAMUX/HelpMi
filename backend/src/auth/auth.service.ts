import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SMS_PROVIDER, type SmsProvider } from './providers/sms.provider.js';

const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(SMS_PROVIDER) private sms: SmsProvider,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    return this.issueOtp(dto.phone);
  }

  async resendOtp(dto: RequestOtpDto) {
    return this.issueOtp(dto.phone);
  }

  private async issueOtp(phone: string) {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
    }
    if (user.isBanned) {
      throw new UnauthorizedException('This account has been suspended');
    }

    const cooldownSeconds = this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS') ?? 60;
    const recent = await this.prisma.otpToken.findFirst({
      where: { phone, createdAt: { gt: new Date(Date.now() - cooldownSeconds * 1000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(
        `Please wait ${cooldownSeconds}s before requesting another code`,
      );
    }

    const code = this.generateOtp();
    const expiryMins = this.config.get<number>('OTP_EXPIRY_MINUTES') ?? 5;
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

    await this.prisma.otpToken.create({
      data: { userId: user.id, phone, code: this.hashOtp(phone, code), expiresAt },
    });

    await this.sms.sendOtp(phone, code);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const token = await this.prisma.otpToken.findFirst({
      where: { phone: dto.phone, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (token.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } });
      throw new UnauthorizedException('Too many attempts. Please request a new code.');
    }

    const matches = token.code === this.hashOtp(dto.phone, dto.code);
    if (!matches) {
      await this.prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } });
    await this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } });

    if (user.isBanned) {
      throw new UnauthorizedException('This account has been suspended');
    }

    const accessToken = this.jwt.sign({ sub: user.id, phone: user.phone });
    return { accessToken, user };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashOtp(phone: string, code: string): string {
    // P3-C: optional server-side pepper. When unset, falls back to the prior
    // scheme so existing tokens/tests remain valid.
    const pepper = this.config.get<string>('OTP_PEPPER');
    const base = pepper ? `${phone}:${code}:${pepper}` : `${phone}:${code}`;
    return createHash('sha256').update(base).digest('hex');
  }
}

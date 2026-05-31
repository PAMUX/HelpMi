import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone: dto.phone } });
    }
    if (user.isBanned) {
      throw new UnauthorizedException('This account has been suspended');
    }

    const code = this.generateOtp();
    const expiryMins = this.config.get<number>('OTP_EXPIRY_MINUTES') ?? 5;
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

    await this.prisma.otpToken.create({
      data: { userId: user.id, phone: dto.phone, code, expiresAt },
    });

    // TODO: Replace with actual SMS gateway (Dialog/Mobitel/Twilio)
    console.log(`[OTP] ${dto.phone} → ${code} (expires in ${expiryMins} min)`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const token = await this.prisma.otpToken.findFirst({
      where: {
        phone: dto.phone,
        code: dto.code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } }),
      this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } }),
    ]);

    if (user.isBanned) {
      throw new UnauthorizedException('This account has been suspended');
    }

    const accessToken = this.jwt.sign({ sub: user.id, phone: user.phone });
    return { accessToken, user };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

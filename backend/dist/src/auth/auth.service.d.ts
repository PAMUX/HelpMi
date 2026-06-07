import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { type SmsProvider } from './providers/sms.provider.js';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private sms;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, sms: SmsProvider);
    requestOtp(dto: RequestOtpDto): Promise<{
        message: string;
    }>;
    resendOtp(dto: RequestOtpDto): Promise<{
        message: string;
    }>;
    private issueOtp;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            isActive: boolean;
            createdAt: Date;
            name: string | null;
            phone: string;
            email: string | null;
            avatarUrl: string | null;
            isDoer: boolean;
            isPoster: boolean;
            isBanned: boolean;
            fcmToken: string | null;
            deletedAt: Date | null;
            updatedAt: Date;
        };
    }>;
    private generateOtp;
    private hashOtp;
}

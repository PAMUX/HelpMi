import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService);
    requestOtp(dto: RequestOtpDto): Promise<{
        message: string;
    }>;
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
            updatedAt: Date;
        };
    }>;
    private generateOtp;
}

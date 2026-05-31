import { AuthService } from './auth.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
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
}

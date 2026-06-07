"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const sms_provider_js_1 = require("./providers/sms.provider.js");
const MAX_VERIFY_ATTEMPTS = 5;
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    sms;
    constructor(prisma, jwt, config, sms) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.sms = sms;
    }
    async requestOtp(dto) {
        return this.issueOtp(dto.phone);
    }
    async resendOtp(dto) {
        return this.issueOtp(dto.phone);
    }
    async issueOtp(phone) {
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.user.create({ data: { phone } });
        }
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('This account has been suspended');
        }
        const cooldownSeconds = this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60;
        const recent = await this.prisma.otpToken.findFirst({
            where: { phone, createdAt: { gt: new Date(Date.now() - cooldownSeconds * 1000) } },
            orderBy: { createdAt: 'desc' },
        });
        if (recent) {
            throw new common_1.BadRequestException(`Please wait ${cooldownSeconds}s before requesting another code`);
        }
        const code = this.generateOtp();
        const expiryMins = this.config.get('OTP_EXPIRY_MINUTES') ?? 5;
        const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);
        await this.prisma.otpToken.create({
            data: { userId: user.id, phone, code: this.hashOtp(phone, code), expiresAt },
        });
        await this.sms.sendOtp(phone, code);
        return { message: 'OTP sent successfully' };
    }
    async verifyOtp(dto) {
        const token = await this.prisma.otpToken.findFirst({
            where: { phone: dto.phone, used: false, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });
        if (!token) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        if (token.attempts >= MAX_VERIFY_ATTEMPTS) {
            await this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } });
            throw new common_1.UnauthorizedException('Too many attempts. Please request a new code.');
        }
        const matches = token.code === this.hashOtp(dto.phone, dto.code);
        if (!matches) {
            await this.prisma.otpToken.update({
                where: { id: token.id },
                data: { attempts: { increment: 1 } },
            });
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } });
        await this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } });
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('This account has been suspended');
        }
        const accessToken = this.jwt.sign({ sub: user.id, phone: user.phone });
        return { accessToken, user };
    }
    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    hashOtp(phone, code) {
        const pepper = this.config.get('OTP_PEPPER');
        const base = pepper ? `${phone}:${code}:${pepper}` : `${phone}:${code}`;
        return (0, crypto_1.createHash)('sha256').update(base).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(sms_provider_js_1.SMS_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map
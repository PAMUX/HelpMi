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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
    }
    async requestOtp(dto) {
        let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        if (!user) {
            user = await this.prisma.user.create({ data: { phone: dto.phone } });
        }
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('This account has been suspended');
        }
        const code = this.generateOtp();
        const expiryMins = this.config.get('OTP_EXPIRY_MINUTES') ?? 5;
        const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);
        await this.prisma.otpToken.create({
            data: { userId: user.id, phone: dto.phone, code, expiresAt },
        });
        console.log(`[OTP] ${dto.phone} → ${code} (expires in ${expiryMins} min)`);
        return { message: 'OTP sent successfully' };
    }
    async verifyOtp(dto) {
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
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        const [user] = await this.prisma.$transaction([
            this.prisma.user.findUniqueOrThrow({ where: { id: token.userId } }),
            this.prisma.otpToken.update({ where: { id: token.id }, data: { used: true } }),
        ]);
        if (user.isBanned) {
            throw new common_1.UnauthorizedException('This account has been suspended');
        }
        const accessToken = this.jwt.sign({ sub: user.id, phone: user.phone });
        return { accessToken, user };
    }
    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
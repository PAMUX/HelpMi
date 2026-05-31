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
exports.DoerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let DoerService = class DoerService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        const profile = await this.prisma.doerProfile.findUnique({
            where: { userId },
            include: { kycReviews: { orderBy: { createdAt: 'desc' }, take: 5 } },
        });
        if (!profile)
            throw new common_1.NotFoundException('Doer profile not found. Submit KYC to become a doer.');
        return profile;
    }
    async submitKyc(userId, dto) {
        const existing = await this.prisma.doerProfile.findUnique({ where: { userId } });
        if (existing && existing.kycStatus === 'APPROVED') {
            throw new common_1.ConflictException('KYC already approved');
        }
        const profile = await this.prisma.doerProfile.upsert({
            where: { userId },
            update: {
                ...dto,
                kycStatus: 'PENDING',
                kycReviewedAt: null,
                kycReviewNote: null,
            },
            create: {
                userId,
                ...dto,
                kycStatus: 'PENDING',
            },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { isDoer: true },
        });
        return profile;
    }
    async getMyTasks(userId) {
        return this.prisma.task.findMany({
            where: { doerId: userId },
            include: { category: true, poster: { select: { id: true, name: true, phone: true } } },
            orderBy: { updatedAt: 'desc' },
        });
    }
};
exports.DoerService = DoerService;
exports.DoerService = DoerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], DoerService);
//# sourceMappingURL=doer.service.js.map
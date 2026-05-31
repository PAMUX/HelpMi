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
exports.RatingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
let RatingsService = class RatingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(raterId, dto) {
        const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.status !== 'COMPLETED') {
            throw new common_1.BadRequestException('Can only rate completed tasks');
        }
        const isPoster = task.posterId === raterId;
        const isDoer = task.doerId === raterId;
        if (!isPoster && !isDoer) {
            throw new common_1.ForbiddenException('Not a participant of this task');
        }
        const rateeId = isPoster ? task.doerId : task.posterId;
        if (!rateeId)
            throw new common_1.BadRequestException('No doer assigned to this task');
        const existing = await this.prisma.rating.findUnique({
            where: { taskId_raterId: { taskId: dto.taskId, raterId } },
        });
        if (existing)
            throw new common_1.BadRequestException('Already rated this task');
        const rating = await this.prisma.rating.create({
            data: {
                taskId: dto.taskId,
                raterId,
                rateeId,
                score: dto.score,
                comment: dto.comment,
                isOnTime: dto.isOnTime,
            },
        });
        await this.updateDoerStats(rateeId);
        return rating;
    }
    async getForUser(userId) {
        const ratings = await this.prisma.rating.findMany({
            where: { rateeId: userId },
            include: {
                rater: { select: { id: true, name: true, avatarUrl: true } },
                task: { select: { title: true, category: { select: { nameEn: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const avg = ratings.length
            ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
            : 0;
        const onTimeCount = ratings.filter((r) => r.isOnTime).length;
        return {
            ratings,
            summary: {
                total: ratings.length,
                average: +avg.toFixed(1),
                onTimeRate: ratings.length ? +(onTimeCount / ratings.length).toFixed(2) : 0,
            },
        };
    }
    async updateDoerStats(userId) {
        const profile = await this.prisma.doerProfile.findUnique({ where: { userId } });
        if (!profile)
            return;
        const ratings = await this.prisma.rating.findMany({ where: { rateeId: userId } });
        if (!ratings.length)
            return;
        const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
        const onTimeCount = ratings.filter((r) => r.isOnTime === true).length;
        const onTimeRated = ratings.filter((r) => r.isOnTime !== null).length;
        await this.prisma.doerProfile.update({
            where: { userId },
            data: {
                avgRating: +avg.toFixed(2),
                onTimeRate: onTimeRated ? +(onTimeCount / onTimeRated).toFixed(2) : 0,
            },
        });
    }
};
exports.RatingsService = RatingsService;
exports.RatingsService = RatingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], RatingsService);
//# sourceMappingURL=ratings.service.js.map
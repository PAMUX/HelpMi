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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const TIER_RANK = { BRONZE: 0, SILVER: 1, GOLD: 2 };
let TasksService = class TasksService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(posterId, dto) {
        const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
        if (!category || !category.isActive) {
            throw new common_1.NotFoundException('Category not found');
        }
        const task = await this.prisma.task.create({
            data: {
                posterId,
                categoryId: dto.categoryId,
                title: dto.title,
                description: dto.description,
                photoUrls: dto.photoUrls ?? [],
                locationLat: dto.locationLat,
                locationLng: dto.locationLng,
                locationAddress: dto.locationAddress,
                budget: dto.budget,
                paymentMode: dto.paymentMode ?? 'ESCROW',
                requiredTier: dto.requiredTier ?? category.minTier,
                scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
                scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
            },
            include: { category: true },
        });
        if (task.paymentMode === 'ESCROW') {
            const budget = Number(task.budget);
            await this.prisma.escrow.create({
                data: {
                    taskId: task.id,
                    posterId,
                    taskBudget: budget,
                    platformFeeFromPoster: +(budget * 0.05).toFixed(2),
                    platformFeeFromDoer: +(budget * 0.15).toFixed(2),
                    trustFundReserve: +(budget * 0.05).toFixed(2),
                    netDoerPayout: +(budget * 0.85).toFixed(2),
                    status: 'PENDING',
                },
            });
        }
        return task;
    }
    async findNearby(dto, userId) {
        const doerProfile = await this.prisma.doerProfile.findUnique({ where: { userId } });
        const doerTier = doerProfile?.kycStatus === 'APPROVED' ? doerProfile.tier : 'BRONZE';
        const eligibleTiers = this.tiersUpTo(doerTier);
        const radiusKm = dto.radiusKm ?? 10;
        const limit = dto.limit ?? 50;
        const tasks = await this.prisma.task.findMany({
            where: {
                status: 'OPEN',
                requiredTier: { in: eligibleTiers },
                posterId: { not: userId },
            },
            include: {
                category: true,
                poster: { select: { id: true, name: true, avatarUrl: true } },
                escrow: { select: { status: true } },
            },
            orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
            take: limit * 3,
        });
        return tasks
            .map((t) => ({
            ...t,
            distance: this.haversine(dto.lat, dto.lng, t.locationLat, t.locationLng),
        }))
            .filter((t) => t.distance <= radiusKm)
            .sort((a, b) => {
            if (a.isFeatured !== b.isFeatured)
                return a.isFeatured ? -1 : 1;
            return a.distance - b.distance;
        })
            .slice(0, limit);
    }
    async findById(id) {
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: {
                category: true,
                poster: { select: { id: true, name: true, avatarUrl: true } },
                doer: { select: { id: true, name: true, avatarUrl: true } },
                escrow: true,
                dispute: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        return task;
    }
    async getAcceptedTasks(userId) {
        return this.prisma.task.findMany({
            where: { doerId: userId },
            include: {
                category: true,
                poster: { select: { id: true, name: true, avatarUrl: true } },
                escrow: { select: { status: true, netDoerPayout: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async getPostedTasks(userId) {
        return this.prisma.task.findMany({
            where: { posterId: userId },
            include: {
                category: true,
                doer: { select: { id: true, name: true, avatarUrl: true } },
                escrow: { select: { status: true, netDoerPayout: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async accept(taskId, doerId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.status !== 'OPEN')
            throw new common_1.BadRequestException('Task is no longer available');
        if (task.posterId === doerId)
            throw new common_1.ForbiddenException('Cannot accept your own task');
        const doerProfile = await this.prisma.doerProfile.findUnique({ where: { userId: doerId } });
        if (!doerProfile || doerProfile.kycStatus !== 'APPROVED') {
            throw new common_1.ForbiddenException('Complete KYC verification before accepting tasks');
        }
        if (TIER_RANK[doerProfile.tier] < TIER_RANK[task.requiredTier]) {
            throw new common_1.ForbiddenException(`This task requires ${task.requiredTier} tier. Your tier is ${doerProfile.tier}.`);
        }
        return this.prisma.task.update({
            where: { id: taskId },
            data: { status: 'ASSIGNED', doerId, acceptedAt: new Date() },
            include: { poster: { select: { id: true, name: true, phone: true } } },
        });
    }
    async markStarted(taskId, doerId) {
        const task = await this.ensureTaskDoer(taskId, doerId);
        if (task.status !== 'ASSIGNED') {
            throw new common_1.BadRequestException('Task must be in ASSIGNED state to start');
        }
        return this.prisma.task.update({
            where: { id: taskId },
            data: { status: 'IN_PROGRESS', startedAt: new Date() },
        });
    }
    async markComplete(taskId, doerId, dto) {
        const task = await this.ensureTaskDoer(taskId, doerId);
        if (!['ASSIGNED', 'IN_PROGRESS'].includes(task.status)) {
            throw new common_1.BadRequestException('Task cannot be marked complete in its current state');
        }
        return this.prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                completionPhotoUrl: dto.completionPhotoUrl,
            },
        });
    }
    async confirm(taskId, posterId) {
        const task = await this.ensureTaskPoster(taskId, posterId);
        if (task.status !== 'COMPLETED') {
            throw new common_1.BadRequestException('Task must be marked complete by doer first');
        }
        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: { confirmedAt: new Date() },
        });
        if (task.paymentMode === 'ESCROW') {
            await this.prisma.escrow.update({
                where: { taskId },
                data: { status: 'RELEASED', releasedAt: new Date(), doerId: task.doerId },
            });
            if (task.doerId) {
                await this.prisma.doerProfile.update({
                    where: { userId: task.doerId },
                    data: { totalJobsCompleted: { increment: 1 } },
                });
            }
        }
        return updated;
    }
    async cancel(taskId, userId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        const isPoster = task.posterId === userId;
        const isDoer = task.doerId === userId;
        if (!isPoster && !isDoer)
            throw new common_1.ForbiddenException('Not authorized');
        if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(task.status)) {
            throw new common_1.BadRequestException('Task cannot be cancelled in its current state');
        }
        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: { status: 'CANCELLED' },
        });
        if (task.paymentMode === 'ESCROW') {
            const escrow = await this.prisma.escrow.findUnique({ where: { taskId } });
            if (escrow && escrow.status === 'HELD') {
                await this.prisma.escrow.update({
                    where: { taskId },
                    data: { status: 'REFUNDED', refundedAt: new Date() },
                });
            }
        }
        return updated;
    }
    async raiseDispute(taskId, userId, reason) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.posterId !== userId && task.doerId !== userId) {
            throw new common_1.ForbiddenException('Not a participant of this task');
        }
        if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(task.status)) {
            throw new common_1.BadRequestException('Cannot raise dispute for this task status');
        }
        const [updatedTask] = await this.prisma.$transaction([
            this.prisma.task.update({ where: { id: taskId }, data: { status: 'DISPUTED' } }),
            this.prisma.dispute.create({ data: { taskId, raisedById: userId, reason } }),
            ...(task.paymentMode === 'ESCROW'
                ? [this.prisma.escrow.update({ where: { taskId }, data: { status: 'DISPUTED' } })]
                : []),
        ]);
        return updatedTask;
    }
    async ensureTaskDoer(taskId, doerId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.doerId !== doerId)
            throw new common_1.ForbiddenException('Not the assigned doer');
        return task;
    }
    async ensureTaskPoster(taskId, posterId) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.posterId !== posterId)
            throw new common_1.ForbiddenException('Not the task poster');
        return task;
    }
    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    tiersUpTo(tier) {
        if (tier === 'GOLD')
            return ['BRONZE', 'SILVER', 'GOLD'];
        if (tier === 'SILVER')
            return ['BRONZE', 'SILVER'];
        return ['BRONZE'];
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map
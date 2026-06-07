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
exports.PayoutService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const payout_provider_js_1 = require("./providers/payout.provider.js");
let PayoutService = class PayoutService {
    prisma;
    provider;
    logger = new common_1.Logger('PayoutService');
    constructor(prisma, provider) {
        this.prisma = prisma;
        this.provider = provider;
    }
    async createForEscrowRelease(input) {
        const existing = await this.prisma.payout.findUnique({ where: { escrowId: input.escrowId } });
        if (existing)
            return existing;
        const profile = await this.prisma.doerProfile.findUnique({ where: { userId: input.doerId } });
        const method = profile?.preferredPayoutMethod ?? 'BANK';
        const destinationSnapshot = method === 'BANK'
            ? {
                bankAccountName: profile?.bankAccountName ?? null,
                bankAccountNumber: profile?.bankAccountNumber ?? null,
                bankName: profile?.bankName ?? null,
                bankBranch: profile?.bankBranch ?? null,
            }
            : {
                mobileWalletProvider: profile?.mobileWalletProvider ?? null,
                mobileWalletNumber: profile?.mobileWalletNumber ?? null,
            };
        let payout;
        try {
            payout = await this.prisma.payout.create({
                data: {
                    escrowId: input.escrowId,
                    taskId: input.taskId,
                    doerId: input.doerId,
                    amount: input.amount,
                    method,
                    status: 'PENDING',
                    destinationSnapshot,
                },
            });
        }
        catch (err) {
            const dup = await this.prisma.payout.findUnique({ where: { escrowId: input.escrowId } });
            if (dup)
                return dup;
            throw err;
        }
        const result = await this.provider.dispatch({
            payoutId: payout.id,
            amount: input.amount,
            method,
            destination: destinationSnapshot,
        });
        return this.prisma.payout.update({
            where: { id: payout.id },
            data: {
                status: result.status,
                providerRef: result.providerRef,
                failureReason: result.failureReason,
                paidAt: result.status === 'PAID' ? new Date() : undefined,
            },
        });
    }
    listForDoer(doerId) {
        return this.prisma.payout.findMany({
            where: { doerId },
            orderBy: { createdAt: 'desc' },
        });
    }
    adminList(status) {
        return this.prisma.payout.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    async markPaid(payoutId, providerRef) {
        const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
        if (!payout)
            throw new common_1.NotFoundException('Payout not found');
        return this.prisma.payout.update({
            where: { id: payoutId },
            data: { status: 'PAID', paidAt: new Date(), providerRef: providerRef ?? payout.providerRef },
        });
    }
    async exportCsv(status) {
        const rows = await this.adminList(status);
        const header = 'id,escrowId,taskId,doerId,amount,method,status,providerRef,createdAt,paidAt';
        const body = rows
            .map((p) => {
            const dest = (p.destinationSnapshot ?? {});
            const acct = dest.bankAccountNumber ?? dest.mobileWalletNumber ?? '';
            return [
                p.id, p.escrowId, p.taskId, p.doerId, p.amount.toString(), p.method, p.status,
                p.providerRef ?? '', p.createdAt.toISOString(), p.paidAt?.toISOString() ?? '', acct,
            ].join(',');
        })
            .join('\n');
        return `${header},account\n${body}`;
    }
};
exports.PayoutService = PayoutService;
exports.PayoutService = PayoutService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        payout_provider_js_1.PayoutProvider])
], PayoutService);
//# sourceMappingURL=payout.service.js.map
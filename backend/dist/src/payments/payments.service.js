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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const crypto_1 = require("crypto");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const notification_events_js_1 = require("../notifications/events/notification-events.js");
const POSTING_FEE_LKR = 99;
let PaymentsService = class PaymentsService {
    prisma;
    config;
    events;
    constructor(prisma, config, events) {
        this.prisma = prisma;
        this.config = config;
        this.events = events;
    }
    async getEscrow(taskId, userId) {
        const escrow = await this.prisma.escrow.findUnique({
            where: { taskId },
            include: { task: { select: { posterId: true, doerId: true, status: true } } },
        });
        if (!escrow)
            throw new common_1.NotFoundException('Escrow not found');
        if (escrow.task.posterId !== userId && escrow.task.doerId !== userId) {
            throw new common_1.BadRequestException('Not authorized to view this escrow');
        }
        return escrow;
    }
    async initiatePayment(taskId, userId) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { escrow: true },
        });
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        if (task.posterId !== userId)
            throw new common_1.BadRequestException('Only the poster can pay');
        const merchantId = this.config.get('PAYHERE_MERCHANT_ID') ?? '';
        const merchantSecret = this.config.get('PAYHERE_MERCHANT_SECRET') ?? '';
        const mode = this.config.get('PAYHERE_MODE') ?? 'sandbox';
        const currency = 'LKR';
        let orderId;
        let amount;
        if (task.paymentMode === 'ESCROW') {
            if (!task.escrow)
                throw new common_1.NotFoundException('Escrow record not found');
            if (task.escrow.status !== 'PENDING')
                throw new common_1.BadRequestException('Payment already initiated');
            orderId = `HM-${taskId.slice(0, 8).toUpperCase()}`;
            amount = Number(task.escrow.taskBudget) + Number(task.escrow.platformFeeFromPoster);
            await this.prisma.escrow.update({ where: { taskId }, data: { payhereOrderId: orderId } });
        }
        else {
            const fee = await this.prisma.postingFee.findUnique({ where: { taskId } });
            if (!fee)
                throw new common_1.NotFoundException('Posting fee record not found');
            if (fee.status !== 'PENDING')
                throw new common_1.BadRequestException('Posting fee already paid');
            orderId = `HMF-${taskId.slice(0, 8).toUpperCase()}`;
            amount = Number(fee.amount ?? POSTING_FEE_LKR);
            await this.prisma.postingFee.update({ where: { taskId }, data: { payhereOrderId: orderId } });
        }
        const hashedSecret = (0, crypto_1.createHash)('md5').update(merchantSecret).digest('hex').toUpperCase();
        const hash = (0, crypto_1.createHash)('md5')
            .update(`${merchantId}${orderId}${amount.toFixed(2)}${currency}${hashedSecret}`)
            .digest('hex')
            .toUpperCase();
        const baseUrl = mode === 'sandbox' ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
        return {
            checkoutUrl: baseUrl,
            params: {
                merchant_id: merchantId,
                return_url: `https://helpmi.lk/payment/return`,
                cancel_url: `https://helpmi.lk/payment/cancel`,
                notify_url: `https://helpmi.lk/api/payments/webhook`,
                order_id: orderId,
                items: task.title,
                currency,
                amount: amount.toFixed(2),
                hash,
            },
        };
    }
    async handleWebhook(body) {
        const merchantId = this.config.get('PAYHERE_MERCHANT_ID') ?? '';
        const merchantSecret = this.config.get('PAYHERE_MERCHANT_SECRET') ?? '';
        const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = body;
        const paymentId = body.payment_id;
        const hashedSecret = (0, crypto_1.createHash)('md5').update(merchantSecret).digest('hex').toUpperCase();
        const expectedSig = (0, crypto_1.createHash)('md5')
            .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
            .digest('hex')
            .toUpperCase();
        if (expectedSig !== md5sig || merchant_id !== merchantId) {
            throw new common_1.BadRequestException('Invalid webhook signature');
        }
        if (status_code !== '2')
            return { received: true };
        const escrow = await this.prisma.escrow.findFirst({ where: { payhereOrderId: order_id } });
        if (escrow)
            return this.applyEscrowPayment(escrow, paymentId);
        const fee = await this.prisma.postingFee.findFirst({ where: { payhereOrderId: order_id } });
        if (fee)
            return this.applyPostingFeePayment(fee, paymentId);
        return { received: true };
    }
    async applyEscrowPayment(escrow, paymentId) {
        if (escrow.status !== 'PENDING' || escrow.payherePaymentId === paymentId) {
            return { received: true };
        }
        const [, promoted] = await this.prisma.$transaction([
            this.prisma.escrow.update({
                where: { id: escrow.id },
                data: { status: 'HELD', payherePaymentId: paymentId, heldAt: new Date() },
            }),
            this.prisma.task.updateMany({
                where: { id: escrow.taskId, status: 'PENDING_PAYMENT' },
                data: { status: 'OPEN' },
            }),
        ]);
        if (promoted.count === 1)
            await this.announceTask(escrow.taskId);
        return { received: true };
    }
    async applyPostingFeePayment(fee, paymentId) {
        if (fee.status !== 'PENDING' || fee.payherePaymentId === paymentId) {
            return { received: true };
        }
        const [, promoted] = await this.prisma.$transaction([
            this.prisma.postingFee.update({
                where: { id: fee.id },
                data: { status: 'PAID', payherePaymentId: paymentId, paidAt: new Date() },
            }),
            this.prisma.task.updateMany({
                where: { id: fee.taskId, status: 'PENDING_PAYMENT' },
                data: { status: 'OPEN' },
            }),
        ]);
        if (promoted.count === 1)
            await this.announceTask(fee.taskId);
        return { received: true };
    }
    async announceTask(taskId) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, posterId: true, title: true, requiredTier: true },
        });
        if (task) {
            this.events.emit(notification_events_js_1.NotificationEvent.TASK_POSTED, {
                taskId: task.id,
                posterId: task.posterId,
                title: task.title,
                requiredTier: task.requiredTier,
            });
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        config_1.ConfigService,
        event_emitter_1.EventEmitter2])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map
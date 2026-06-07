import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';

const POSTING_FEE_LKR = 99;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private events: EventEmitter2,
  ) {}

  async getEscrow(taskId: string, userId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { taskId },
      include: { task: { select: { posterId: true, doerId: true, status: true } } },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.task.posterId !== userId && escrow.task.doerId !== userId) {
      throw new BadRequestException('Not authorized to view this escrow');
    }
    return escrow;
  }

  /**
   * Builds a PayHere hosted-checkout payload. Handles both escrow funding (ESCROW
   * tasks, order id "HM-…") and the Rs. 99 cash posting fee (CASH tasks, order
   * id "HMF-…"). The order-id prefix lets the webhook route safely (P3-B).
   */
  async initiatePayment(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { escrow: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== userId) throw new BadRequestException('Only the poster can pay');

    const merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID') ?? '';
    const merchantSecret = this.config.get<string>('PAYHERE_MERCHANT_SECRET') ?? '';
    const mode = this.config.get<string>('PAYHERE_MODE') ?? 'sandbox';
    const currency = 'LKR';

    let orderId: string;
    let amount: number;

    if (task.paymentMode === 'ESCROW') {
      if (!task.escrow) throw new NotFoundException('Escrow record not found');
      if (task.escrow.status !== 'PENDING') throw new BadRequestException('Payment already initiated');
      orderId = `HM-${taskId.slice(0, 8).toUpperCase()}`;
      amount = Number(task.escrow.taskBudget) + Number(task.escrow.platformFeeFromPoster);
      await this.prisma.escrow.update({ where: { taskId }, data: { payhereOrderId: orderId } });
    } else {
      // CASH: collect the flat posting fee.
      const fee = await this.prisma.postingFee.findUnique({ where: { taskId } });
      if (!fee) throw new NotFoundException('Posting fee record not found');
      if (fee.status !== 'PENDING') throw new BadRequestException('Posting fee already paid');
      orderId = `HMF-${taskId.slice(0, 8).toUpperCase()}`;
      amount = Number(fee.amount ?? POSTING_FEE_LKR);
      await this.prisma.postingFee.update({ where: { taskId }, data: { payhereOrderId: orderId } });
    }

    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hash = createHash('md5')
      .update(`${merchantId}${orderId}${amount.toFixed(2)}${currency}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    const baseUrl =
      mode === 'sandbox' ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';

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

  async handleWebhook(body: Record<string, string>) {
    const merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID') ?? '';
    const merchantSecret = this.config.get<string>('PAYHERE_MERCHANT_SECRET') ?? '';

    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = body;
    const paymentId = body.payment_id;

    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const expectedSig = createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    if (expectedSig !== md5sig || merchant_id !== merchantId) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (status_code !== '2') return { received: true };

    // Route by which record owns this order id (prefix HM- escrow vs HMF- fee).
    const escrow = await this.prisma.escrow.findFirst({ where: { payhereOrderId: order_id } });
    if (escrow) return this.applyEscrowPayment(escrow, paymentId);

    const fee = await this.prisma.postingFee.findFirst({ where: { payhereOrderId: order_id } });
    if (fee) return this.applyPostingFeePayment(fee, paymentId);

    return { received: true };
  }

  private async applyEscrowPayment(
    escrow: { id: string; taskId: string; status: string; payherePaymentId: string | null },
    paymentId: string,
  ) {
    // P3-C idempotency: skip if not pending or this exact payment already applied.
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

    if (promoted.count === 1) await this.announceTask(escrow.taskId);
    return { received: true };
  }

  private async applyPostingFeePayment(
    fee: { id: string; taskId: string; status: string; payherePaymentId: string | null },
    paymentId: string,
  ) {
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

    if (promoted.count === 1) await this.announceTask(fee.taskId);
    return { received: true };
  }

  private async announceTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, posterId: true, title: true, requiredTier: true },
    });
    if (task) {
      this.events.emit(NotificationEvent.TASK_POSTED, {
        taskId: task.id,
        posterId: task.posterId,
        title: task.title,
        requiredTier: task.requiredTier,
      });
    }
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEvent } from '../notifications/events/notification-events.js';
import { RefundService } from './refund.service.js';

const POSTING_FEE_LKR = 99;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private events: EventEmitter2,
    private refunds: RefundService,
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
      // G-2/B7-4: full task UUID — 8-hex prefixes collide at scale, and
      // payhereOrderId is now unique, so a collision would 500 the initiate.
      orderId = `HM-${taskId.toUpperCase()}`;
      amount = Number(task.escrow.taskBudget) + Number(task.escrow.platformFeeFromPoster);
      await this.prisma.escrow.update({ where: { taskId }, data: { payhereOrderId: orderId } });
    } else {
      // CASH: collect the flat posting fee.
      const fee = await this.prisma.postingFee.findUnique({ where: { taskId } });
      if (!fee) throw new NotFoundException('Posting fee record not found');
      if (fee.status !== 'PENDING') throw new BadRequestException('Posting fee already paid');
      orderId = `HMF-${taskId.toUpperCase()}`;
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

    // G-8: callback URLs are environment-driven (previously hardcoded to
    // helpmi.lk, which silently broke webhooks in any other environment).
    const { returnUrl, cancelUrl, notifyUrl } = this.callbackUrls();

    return {
      checkoutUrl: baseUrl,
      params: {
        merchant_id: merchantId,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        order_id: orderId,
        items: task.title,
        currency,
        amount: amount.toFixed(2),
        hash,
      },
    };
  }

  /**
   * G-8: derive PayHere callback URLs from APP_PUBLIC_BASE_URL, with optional
   * explicit overrides (PAYHERE_RETURN_URL / PAYHERE_CANCEL_URL /
   * PAYHERE_NOTIFY_URL). Fails fast with an actionable message when missing —
   * a checkout whose webhook can never arrive must not be issued at all.
   * Note: local sandbox testing needs a public tunnel (ngrok/cloudflared).
   */
  private callbackUrls(): { returnUrl: string; cancelUrl: string; notifyUrl: string } {
    const base = (this.config.get<string>('APP_PUBLIC_BASE_URL') ?? '').trim().replace(/\/$/, '');
    const pick = (key: string, fallback: string): string => {
      const explicit = (this.config.get<string>(key) ?? '').trim();
      return explicit || fallback;
    };
    const returnUrl = pick('PAYHERE_RETURN_URL', base ? `${base}/payment/return` : '');
    const cancelUrl = pick('PAYHERE_CANCEL_URL', base ? `${base}/payment/cancel` : '');
    const notifyUrl = pick('PAYHERE_NOTIFY_URL', base ? `${base}/api/payments/webhook` : '');
    if (!returnUrl || !cancelUrl || !notifyUrl) {
      throw new BadRequestException(
        'Payment configuration incomplete: set APP_PUBLIC_BASE_URL (or PAYHERE_*_URL overrides)',
      );
    }
    return { returnUrl, cancelUrl, notifyUrl };
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

  /**
   * G-2: race-protected escrow funding. The task-promotion CAS runs FIRST and
   * is the authority — money becomes HELD only when the task really moved
   * PENDING_PAYMENT → OPEN. If the task was cancelled while the poster was
   * paying, the captured payment is recorded and routed straight to the G-1
   * refund lifecycle; a CANCELLED+HELD state can no longer be produced.
   * Task-then-escrow write order matches cancel(), so the two transactions
   * serialize on the task row without deadlock.
   */
  private async applyEscrowPayment(
    escrow: { id: string; taskId: string; status: string; payherePaymentId: string | null },
    paymentId: string,
  ) {
    // P3-C idempotency: skip if not pending or this exact payment already applied.
    if (escrow.status !== 'PENDING' || escrow.payherePaymentId === paymentId) {
      return { received: true };
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      const promoted = await tx.task.updateMany({
        where: { id: escrow.taskId, status: 'PENDING_PAYMENT' },
        data: { status: 'OPEN' },
      });

      if (promoted.count === 1) {
        await tx.escrow.updateMany({
          where: { id: escrow.id, status: 'PENDING' },
          data: { status: 'HELD', payherePaymentId: paymentId, heldAt: new Date() },
        });
        return 'open' as const;
      }

      const task = await tx.task.findUnique({
        where: { id: escrow.taskId },
        select: { status: true },
      });
      if (!task || task.status === 'CANCELLED') {
        // Money arrived for a dead task: capture the payment id and hand the
        // funds to the refund lifecycle — never HELD.
        await tx.escrow.updateMany({
          where: { id: escrow.id, status: 'PENDING' },
          data: { status: 'REFUND_PENDING', payherePaymentId: paymentId, heldAt: new Date() },
        });
        return 'refund' as const;
      }

      // Defensive: task already past PENDING_PAYMENT through some other path —
      // hold the funds but don't re-announce.
      await tx.escrow.updateMany({
        where: { id: escrow.id, status: 'PENDING' },
        data: { status: 'HELD', payherePaymentId: paymentId, heldAt: new Date() },
      });
      return 'held-only' as const;
    });

    if (outcome === 'open') {
      await this.announceTask(escrow.taskId);
    } else if (outcome === 'refund') {
      try {
        await this.refunds.initiateForEscrow({
          escrowId: escrow.id,
          taskId: escrow.taskId,
          reason: 'CANCEL',
          initiatedBy: 'system:webhook',
        });
      } catch (err) {
        // Reconcile sweep retries REFUND_PENDING escrows; never fail the webhook.
        this.logger.error(
          `Refund initiation failed for escrow ${escrow.id}: ${(err as Error).message}`,
        );
      }
    }
    return { received: true };
  }

  private async applyPostingFeePayment(
    fee: { id: string; taskId: string; status: string; payherePaymentId: string | null },
    paymentId: string,
  ) {
    if (fee.status !== 'PENDING' || fee.payherePaymentId === paymentId) {
      return { received: true };
    }

    // G-2: same promote-first CAS as escrow funding. A fee landing on a
    // cancelled task is recorded as REFUNDED (Rs. 99 — manual settlement via
    // the admin payout/refund review; full automation rides with G-7B).
    const outcome = await this.prisma.$transaction(async (tx) => {
      const promoted = await tx.task.updateMany({
        where: { id: fee.taskId, status: 'PENDING_PAYMENT' },
        data: { status: 'OPEN' },
      });

      if (promoted.count === 1) {
        await tx.postingFee.updateMany({
          where: { id: fee.id, status: 'PENDING' },
          data: { status: 'PAID', payherePaymentId: paymentId, paidAt: new Date() },
        });
        return 'open' as const;
      }

      const task = await tx.task.findUnique({
        where: { id: fee.taskId },
        select: { status: true },
      });
      if (!task || task.status === 'CANCELLED') {
        await tx.postingFee.updateMany({
          where: { id: fee.id, status: 'PENDING' },
          data: { status: 'REFUNDED', payherePaymentId: paymentId, paidAt: new Date() },
        });
        return 'refund' as const;
      }

      await tx.postingFee.updateMany({
        where: { id: fee.id, status: 'PENDING' },
        data: { status: 'PAID', payherePaymentId: paymentId, paidAt: new Date() },
      });
      return 'held-only' as const;
    });

    if (outcome === 'open') await this.announceTask(fee.taskId);
    if (outcome === 'refund') {
      this.logger.warn(
        `Posting fee for cancelled task ${fee.taskId} marked REFUNDED (payment ${paymentId}); settle manually`,
      );
    }
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

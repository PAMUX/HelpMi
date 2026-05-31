import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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

  async initiatePayment(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { escrow: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.posterId !== userId) throw new BadRequestException('Only the poster can pay');
    if (task.paymentMode !== 'ESCROW') throw new BadRequestException('Task is not escrow-based');
    if (!task.escrow) throw new NotFoundException('Escrow record not found');
    if (task.escrow.status !== 'PENDING') {
      throw new BadRequestException('Payment already initiated');
    }

    const merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID') ?? '';
    const merchantSecret = this.config.get<string>('PAYHERE_MERCHANT_SECRET') ?? '';
    const mode = this.config.get<string>('PAYHERE_MODE') ?? 'sandbox';
    const orderId = `HM-${taskId.slice(0, 8).toUpperCase()}`;
    const amount = Number(task.escrow.taskBudget) + Number(task.escrow.platformFeeFromPoster);
    const currency = 'LKR';

    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hash = createHash('md5')
      .update(`${merchantId}${orderId}${amount.toFixed(2)}${currency}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    await this.prisma.escrow.update({
      where: { taskId },
      data: { payhereOrderId: orderId },
    });

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

    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const expectedSig = createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
      .digest('hex')
      .toUpperCase();

    if (expectedSig !== md5sig || merchant_id !== merchantId) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const escrow = await this.prisma.escrow.findFirst({
      where: { payhereOrderId: order_id },
    });
    if (!escrow) return { received: true };

    if (status_code === '2') {
      await this.prisma.$transaction([
        this.prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            status: 'HELD',
            payherePaymentId: body.payment_id,
            heldAt: new Date(),
          },
        }),
        this.prisma.task.update({
          where: { id: escrow.taskId },
          data: { status: 'OPEN' },
        }),
      ]);
    }

    return { received: true };
  }
}

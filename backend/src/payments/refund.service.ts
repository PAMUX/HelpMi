import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayHereClient } from './providers/payhere.client.js';

/**
 * G-1: the real refund lifecycle.
 *
 *   escrow HELD/DISPUTED ──claim──▶ REFUND_PENDING ──provider OK──▶ REFUNDED
 *                                        │
 *                                        └─ provider down/unconfigured/failed:
 *                                           Refund row stays PENDING/FAILED and
 *                                           the hourly reconcile sweep + admin
 *                                           retry endpoint re-execute it.
 *
 * Invariants:
 *  - exactly one Refund per escrow (unique escrowId, FK-enforced);
 *  - escrow.status === 'REFUNDED' only after the provider confirmed;
 *  - initiate/execute are idempotent and CAS-guarded, so cancel(), the
 *    webhook race path, the sweep and admin retries can all call them
 *    concurrently without double-moving money.
 */
type RefundReasonValue = 'CANCEL' | 'DISPUTE' | 'ADMIN';
type RefundStatusFilter = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface InitiateRefundInput {
  escrowId: string;
  taskId: string;
  reason: RefundReasonValue;
  initiatedBy: string;
}

const REFUNDABLE_ESCROW_STATES = ['HELD', 'DISPUTED', 'REFUND_PENDING'];

@Injectable()
export class RefundService {
  private readonly logger = new Logger('RefundService');

  constructor(
    private prisma: PrismaService,
    private client: PayHereClient,
  ) {}

  /**
   * Idempotently ensure a refund exists for this escrow and try to execute it.
   * Safe to call from cancel(), the webhook, the sweep and the admin tool.
   */
  async initiateForEscrow(input: InitiateRefundInput) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id: input.escrowId } });
    if (!escrow) throw new NotFoundException('Escrow not found');

    const existing = await this.prisma.refund.findUnique({ where: { escrowId: escrow.id } });
    if (existing) {
      if (existing.status === 'COMPLETED' || existing.status === 'PROCESSING') return existing;
      return this.execute(existing.id, input.initiatedBy); // PENDING | FAILED → retry
    }

    if (!REFUNDABLE_ESCROW_STATES.includes(escrow.status)) {
      throw new BadRequestException(`Escrow is ${escrow.status}; there is nothing to refund`);
    }
    if (!escrow.payherePaymentId) {
      throw new BadRequestException('No captured payment on this escrow; nothing to refund');
    }

    // Claim the money state. CAS keeps a concurrent release from racing us;
    // REFUND_PENDING may legitimately already be set by cancel()/webhook.
    await this.prisma.escrow.updateMany({
      where: { id: escrow.id, status: { in: ['HELD', 'DISPUTED'] } },
      data: { status: 'REFUND_PENDING' },
    });

    // Full charge back to the poster: budget + the 5% poster fee they paid.
    const amount = Number(escrow.taskBudget) + Number(escrow.platformFeeFromPoster);

    let refund;
    try {
      refund = await this.prisma.refund.create({
        data: {
          escrowId: escrow.id,
          taskId: input.taskId,
          amount,
          reason: input.reason,
          status: 'PENDING',
          initiatedBy: input.initiatedBy,
        },
      });
    } catch {
      // Unique violation on escrowId — another path created it concurrently.
      const dup = await this.prisma.refund.findUnique({ where: { escrowId: escrow.id } });
      if (!dup) throw new BadRequestException('Could not create refund record');
      if (dup.status === 'COMPLETED' || dup.status === 'PROCESSING') return dup;
      return this.execute(dup.id, input.initiatedBy);
    }

    return this.execute(refund.id, input.initiatedBy);
  }

  /**
   * Execute (or re-execute) a refund against PayHere. CAS PENDING/FAILED →
   * PROCESSING collapses concurrent executors to one provider call.
   */
  async execute(refundId: string, actor: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { escrow: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status === 'COMPLETED' || refund.status === 'PROCESSING') return refund;

    if (!this.client.isConfigured()) {
      // Queue: stay PENDING; the sweep/admin retries once credentials exist.
      this.logger.warn(`PayHere Merchant API not configured; refund ${refundId} queued`);
      return this.prisma.refund.update({
        where: { id: refundId },
        data: {
          failureReason: 'PayHere Merchant API not configured; refund queued',
          lastAttemptedBy: actor,
        },
      });
    }

    const claimed = await this.prisma.refund.updateMany({
      where: { id: refundId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastAttemptedBy: actor },
    });
    if (claimed.count === 0) {
      return this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    }

    const result = await this.client.refundPayment(
      refund.escrow.payherePaymentId as string,
      `HelpMi ${refund.reason} refund for task ${refund.taskId}`,
    );

    if (result.success) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.refund.update({
          where: { id: refundId },
          data: {
            status: 'COMPLETED',
            providerRef: result.providerRef,
            failureReason: null,
            completedAt: new Date(),
          },
        }),
        this.prisma.escrow.update({
          where: { id: refund.escrowId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        }),
      ]);
      this.logger.log(`Refund ${refundId} completed (provider ref ${result.providerRef ?? 'n/a'})`);
      return updated;
    }

    return this.prisma.refund.update({
      where: { id: refundId },
      data: { status: 'FAILED', failureReason: result.error ?? 'Refund failed' },
    });
  }

  /** Admin retry — explicit 400 on already-completed instead of a silent no-op. */
  async retry(refundId: string, adminPhone: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status === 'COMPLETED') {
      throw new BadRequestException('Refund already completed');
    }
    if (refund.status === 'PROCESSING') {
      throw new BadRequestException('Refund is currently processing');
    }
    return this.execute(refundId, `admin:${adminPhone}`);
  }

  list(status?: RefundStatusFilter) {
    return this.prisma.refund.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * G-2 sweep: re-drive anything stuck, and repair the (now theoretically
   * impossible) CANCELLED-task/HELD-escrow anomaly if it ever appears.
   */
  async reconcile(): Promise<{ scanned: number; completed: number }> {
    let completed = 0;

    const pendingEscrows = await this.prisma.escrow.findMany({
      where: { status: 'REFUND_PENDING' },
      select: { id: true, taskId: true },
      take: 100,
    });
    for (const escrow of pendingEscrows) {
      try {
        const refund = await this.initiateForEscrow({
          escrowId: escrow.id,
          taskId: escrow.taskId,
          reason: 'ADMIN',
          initiatedBy: 'system:reconcile',
        });
        if (refund.status === 'COMPLETED') completed += 1;
      } catch (err) {
        this.logger.error(`Reconcile failed for escrow ${escrow.id}: ${(err as Error).message}`);
      }
    }

    const anomalies = await this.prisma.escrow.findMany({
      where: { status: 'HELD', task: { status: 'CANCELLED' } },
      select: { id: true, taskId: true },
      take: 100,
    });
    for (const escrow of anomalies) {
      this.logger.warn(
        `Anomaly: HELD escrow ${escrow.id} on CANCELLED task ${escrow.taskId} — routing to refund`,
      );
      try {
        const refund = await this.initiateForEscrow({
          escrowId: escrow.id,
          taskId: escrow.taskId,
          reason: 'ADMIN',
          initiatedBy: 'system:reconcile',
        });
        if (refund.status === 'COMPLETED') completed += 1;
      } catch (err) {
        this.logger.error(`Anomaly repair failed for escrow ${escrow.id}: ${(err as Error).message}`);
      }
    }

    return { scanned: pendingEscrows.length + anomalies.length, completed };
  }
}

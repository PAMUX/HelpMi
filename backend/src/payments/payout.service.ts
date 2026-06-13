import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PayoutMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayoutProvider } from './providers/payout.provider.js';

export interface CreatePayoutInput {
  escrowId: string;
  taskId: string;
  doerId: string;
  amount: number;
}

@Injectable()
export class PayoutService {
  private readonly logger = new Logger('PayoutService');

  constructor(
    private prisma: PrismaService,
    private provider: PayoutProvider,
  ) {}

  /**
   * P3-A: create exactly one payout per escrow release. The escrowId unique
   * constraint guarantees idempotency even under retries/races — a duplicate
   * create is caught and the existing payout returned.
   */
  async createForEscrowRelease(input: CreatePayoutInput) {
    const existing = await this.prisma.payout.findUnique({ where: { escrowId: input.escrowId } });
    if (existing) return existing;

    const profile = await this.prisma.doerProfile.findUnique({ where: { userId: input.doerId } });
    // G-7A (launch scope): force BANK regardless of stored preference until the
    // wallet payout integration (G-7B) ships. Wallet preferences saved before
    // this change settle via the bank CSV batch instead of fake-PROCESSING.
    const method: PayoutMethod = 'BANK';
    const destinationSnapshot = {
      bankAccountName: profile?.bankAccountName ?? null,
      bankAccountNumber: profile?.bankAccountNumber ?? null,
      bankName: profile?.bankName ?? null,
      bankBranch: profile?.bankBranch ?? null,
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
    } catch (err) {
      // Unique violation on escrowId => another path already created it.
      const dup = await this.prisma.payout.findUnique({ where: { escrowId: input.escrowId } });
      if (dup) return dup;
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

  listForDoer(doerId: string) {
    return this.prisma.payout.findMany({
      where: { doerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  adminList(status?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED') {
    return this.prisma.payout.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markPaid(payoutId: string, providerRef?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'PAID', paidAt: new Date(), providerRef: providerRef ?? payout.providerRef },
    });
  }

  async exportCsv(status?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'): Promise<string> {
    const rows = await this.adminList(status);
    const header = 'id,escrowId,taskId,doerId,amount,method,status,providerRef,createdAt,paidAt';
    const body = rows
      .map((p: any) => {
        const dest = (p.destinationSnapshot ?? {}) as Record<string, unknown>;
        const acct = dest.bankAccountNumber ?? dest.mobileWalletNumber ?? '';
        return [
          p.id, p.escrowId, p.taskId, p.doerId, p.amount.toString(), p.method, p.status,
          p.providerRef ?? '', p.createdAt.toISOString(), p.paidAt?.toISOString() ?? '', acct,
        ].join(',');
      })
      .join('\n');
    return `${header},account\n${body}`;
  }
}

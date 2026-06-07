import { PrismaService } from '../prisma/prisma.service.js';
import { PayoutProvider } from './providers/payout.provider.js';
export interface CreatePayoutInput {
    escrowId: string;
    taskId: string;
    doerId: string;
    amount: number;
}
export declare class PayoutService {
    private prisma;
    private provider;
    private readonly logger;
    constructor(prisma: PrismaService, provider: PayoutProvider);
    createForEscrowRelease(input: CreatePayoutInput): Promise<{
        id: string;
        createdAt: Date;
        method: import("@prisma/client").$Enums.PayoutMethod;
        updatedAt: Date;
        taskId: string;
        escrowId: string;
        doerId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.PayoutStatus;
        providerRef: string | null;
        failureReason: string | null;
        destinationSnapshot: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }>;
    listForDoer(doerId: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        method: import("@prisma/client").$Enums.PayoutMethod;
        updatedAt: Date;
        taskId: string;
        escrowId: string;
        doerId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.PayoutStatus;
        providerRef: string | null;
        failureReason: string | null;
        destinationSnapshot: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }[]>;
    adminList(status?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        method: import("@prisma/client").$Enums.PayoutMethod;
        updatedAt: Date;
        taskId: string;
        escrowId: string;
        doerId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.PayoutStatus;
        providerRef: string | null;
        failureReason: string | null;
        destinationSnapshot: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }[]>;
    markPaid(payoutId: string, providerRef?: string): Promise<{
        id: string;
        createdAt: Date;
        method: import("@prisma/client").$Enums.PayoutMethod;
        updatedAt: Date;
        taskId: string;
        escrowId: string;
        doerId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.PayoutStatus;
        providerRef: string | null;
        failureReason: string | null;
        destinationSnapshot: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }>;
    exportCsv(status?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'): Promise<string>;
}

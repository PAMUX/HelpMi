import { PaymentsService } from './payments.service.js';
import { type JwtPayload } from '../common/decorators/current-user.decorator.js';
export declare class PaymentsController {
    private payments;
    constructor(payments: PaymentsService);
    getEscrow(taskId: string, user: JwtPayload): Promise<{
        task: {
            posterId: string;
            status: import("@prisma/client").$Enums.TaskStatus;
            doerId: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        taskId: string;
        posterId: string;
        status: import("@prisma/client").$Enums.EscrowStatus;
        doerId: string | null;
        taskBudget: import("@prisma/client-runtime-utils").Decimal;
        platformFeeFromPoster: import("@prisma/client-runtime-utils").Decimal;
        platformFeeFromDoer: import("@prisma/client-runtime-utils").Decimal;
        trustFundReserve: import("@prisma/client-runtime-utils").Decimal;
        netDoerPayout: import("@prisma/client-runtime-utils").Decimal | null;
        payherePaymentId: string | null;
        payhereOrderId: string | null;
        payoutMethod: import("@prisma/client").$Enums.PayoutMethod;
        heldAt: Date | null;
        releasedAt: Date | null;
        refundedAt: Date | null;
    }>;
    initiatePayment(taskId: string, user: JwtPayload): Promise<{
        checkoutUrl: string;
        params: {
            merchant_id: string;
            return_url: string;
            cancel_url: string;
            notify_url: string;
            order_id: string;
            items: string;
            currency: string;
            amount: string;
            hash: string;
        };
    }>;
    handleWebhook(body: Record<string, string>): Promise<{
        received: boolean;
    }>;
}

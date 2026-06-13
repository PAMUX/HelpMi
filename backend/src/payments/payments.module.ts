import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { PayoutService } from './payout.service.js';
import { PayoutProvider } from './providers/payout.provider.js';
// G-1: refund lifecycle (PayHere Merchant API client + refund ledger service).
import { RefundService } from './refund.service.js';
import { PayHereClient } from './providers/payhere.client.js';

@Module({
  providers: [PaymentsService, PayoutService, PayoutProvider, RefundService, PayHereClient],
  controllers: [PaymentsController],
  exports: [PayoutService, RefundService],
})
export class PaymentsModule {}

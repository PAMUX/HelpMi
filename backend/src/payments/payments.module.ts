import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { PayoutService } from './payout.service.js';
import { PayoutProvider } from './providers/payout.provider.js';

@Module({
  providers: [PaymentsService, PayoutService, PayoutProvider],
  controllers: [PaymentsController],
  exports: [PayoutService],
})
export class PaymentsModule {}

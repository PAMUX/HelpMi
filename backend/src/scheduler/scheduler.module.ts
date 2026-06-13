import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module.js';
// G-2: the reconcile sweep drives RefundService (exported by PaymentsModule).
import { PaymentsModule } from '../payments/payments.module.js';
import { SchedulerService } from './scheduler.service.js';

@Module({
  imports: [TasksModule, PaymentsModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

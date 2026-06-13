import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
// G-3: admin reviews private KYC documents via UploadsService.presignRead.
import { UploadsModule } from '../uploads/uploads.module.js';
// G-2: force-cancel recovery delegates to TasksService.
import { TasksModule } from '../tasks/tasks.module.js';

@Module({
  imports: [PaymentsModule, UploadsModule, TasksModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}

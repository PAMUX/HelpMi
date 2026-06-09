import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
// G-3: admin reviews private KYC documents via UploadsService.presignRead.
import { UploadsModule } from '../uploads/uploads.module.js';

@Module({
  imports: [PaymentsModule, UploadsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}

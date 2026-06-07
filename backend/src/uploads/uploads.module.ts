import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';
import { StorageProvider } from './storage.provider.js';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, StorageProvider],
  exports: [UploadsService],
})
export class UploadsModule {}

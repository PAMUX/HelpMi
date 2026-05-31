import { Module } from '@nestjs/common';
import { DoerService } from './doer.service.js';
import { DoerController } from './doer.controller.js';

@Module({
  providers: [DoerService],
  controllers: [DoerController],
  exports: [DoerService],
})
export class DoerModule {}

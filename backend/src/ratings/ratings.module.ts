import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service.js';
import { RatingsController } from './ratings.controller.js';

@Module({
  providers: [RatingsService],
  controllers: [RatingsController],
})
export class RatingsModule {}

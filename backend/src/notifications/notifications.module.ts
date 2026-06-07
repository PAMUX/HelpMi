import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsListener } from './notifications.listener.js';
import { pushProviderFactory } from './providers/push.provider.js';

@Module({
  providers: [NotificationsService, NotificationsListener, pushProviderFactory],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

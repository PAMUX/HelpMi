import { Controller, Get, Patch, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  getAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.getForUser(user.id);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notifications.getUnreadCount(user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notifications.markRead(id, user.id);
  }
}

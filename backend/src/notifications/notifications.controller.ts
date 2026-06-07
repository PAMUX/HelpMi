import { Controller, Get, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @ApiOperation({ summary: 'List my notifications' })
  @Get()
  getAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.getForUser(user.id);
  }

  @ApiOperation({ summary: 'Unread notification count' })
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notifications.getUnreadCount(user.id);
  }

  @ApiOperation({ summary: 'Mark all read' })
  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Mark one read' })
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notifications.markRead(id, user.id);
  }
}

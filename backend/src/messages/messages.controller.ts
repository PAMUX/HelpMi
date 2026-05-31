import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get('unread')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messages.getUnreadCount(user.id);
  }

  @Get(':taskId')
  getMessages(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.getMessages(taskId, user.id);
  }

  @Post(':taskId')
  sendMessage(
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendMessage(taskId, user.id, dto);
  }
}

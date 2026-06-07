import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @ApiOperation({ summary: 'Unread message count' })
  @Get('unread')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.messages.getUnreadCount(user.id);
  }

  @ApiOperation({ summary: 'Get a task thread (marks read)' })
  @Get(':taskId')
  getMessages(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.getMessages(taskId, user.id);
  }

  @ApiOperation({ summary: 'Send a message' })
  @Post(':taskId')
  sendMessage(
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendMessage(taskId, user.id, dto);
  }
}

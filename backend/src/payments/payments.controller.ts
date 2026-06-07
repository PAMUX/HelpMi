import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @ApiOperation({ summary: 'Get escrow for a task' })
  @Get(':taskId')
  getEscrow(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.payments.getEscrow(taskId, user.id);
  }

  @ApiOperation({ summary: 'Initiate PayHere payment (escrow or Rs.99 fee)' })
  @Post('initiate/:taskId')
  initiatePayment(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.payments.initiatePayment(taskId, user.id);
  }

  @ApiOperation({ summary: 'PayHere webhook (server-to-server)' })
  @Public()
  @Post('webhook')
  handleWebhook(@Body() body: Record<string, string>) {
    return this.payments.handleWebhook(body);
  }
}

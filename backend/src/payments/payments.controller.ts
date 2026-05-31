import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get(':taskId')
  getEscrow(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.payments.getEscrow(taskId, user.id);
  }

  @Post('initiate/:taskId')
  initiatePayment(@Param('taskId') taskId: string, @CurrentUser() user: JwtPayload) {
    return this.payments.initiatePayment(taskId, user.id);
  }

  @Public()
  @Post('webhook')
  handleWebhook(@Body() body: Record<string, string>) {
    return this.payments.handleWebhook(body);
  }
}

import { Controller, Get, Post, Body } from '@nestjs/common';
import { DoerService } from './doer.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@Controller('doer')
export class DoerController {
  constructor(private doer: DoerService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.doer.getProfile(user.id);
  }

  @Post('kyc')
  submitKyc(@CurrentUser() user: JwtPayload, @Body() dto: SubmitKycDto) {
    return this.doer.submitKyc(user.id, dto);
  }

  @Get('my-tasks')
  getMyTasks(@CurrentUser() user: JwtPayload) {
    return this.doer.getMyTasks(user.id);
  }
}

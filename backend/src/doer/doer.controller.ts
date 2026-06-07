import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DoerService } from './doer.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';
import { PayoutMethodDto } from './dto/payout-method.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('doer')
@ApiBearerAuth('access-token')
@Controller('doer')
export class DoerController {
  constructor(private doer: DoerService) {}

  @ApiOperation({ summary: 'Get my doer profile' })
  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.doer.getProfile(user.id);
  }

  @ApiOperation({ summary: 'Submit / resubmit KYC' })
  @Post('kyc')
  submitKyc(@CurrentUser() user: JwtPayload, @Body() dto: SubmitKycDto) {
    return this.doer.submitKyc(user.id, dto);
  }

  @ApiOperation({ summary: 'Set / update payout destination' })
  @Post('payout-method')
  setPayoutMethod(@CurrentUser() user: JwtPayload, @Body() dto: PayoutMethodDto) {
    return this.doer.setPayoutMethod(user.id, dto);
  }

  @ApiOperation({ summary: 'My payout history' })
  @Get('payouts')
  getPayouts(@CurrentUser() user: JwtPayload) {
    return this.doer.getPayouts(user.id);
  }

  @ApiOperation({ summary: 'Tasks assigned to me' })
  @Get('my-tasks')
  getMyTasks(@CurrentUser() user: JwtPayload) {
    return this.doer.getMyTasks(user.id);
  }
}

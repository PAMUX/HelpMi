import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @ApiOperation({ summary: 'Request an OTP for a phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @ApiOperation({ summary: 'Resend an OTP (cooldown enforced)' })
  @ApiResponse({ status: 400, description: 'Cooldown not elapsed' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: RequestOtpDto) {
    return this.auth.resendOtp(dto);
  }

  @ApiOperation({ summary: 'Verify an OTP and receive a JWT' })
  @ApiResponse({ status: 200, description: 'Returns accessToken + user' })
  @ApiResponse({ status: 401, description: 'Invalid/expired OTP or too many attempts' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }
}

import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @Get('kyc/pending')
  getPendingKyc() {
    return this.admin.getPendingKyc();
  }

  @Patch('kyc/:id/approve')
  approveKyc(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body('tier') tier: 'BRONZE' | 'SILVER' | 'GOLD',
  ) {
    return this.admin.approveKyc(id, admin.phone, tier);
  }

  @Patch('kyc/:id/reject')
  rejectKyc(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body('note') note: string,
  ) {
    return this.admin.rejectKyc(id, admin.phone, note);
  }

  @Get('users')
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getUsers(page ? +page : 1, limit ? +limit : 50);
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.admin.banUser(id);
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.admin.unbanUser(id);
  }

  @Get('disputes')
  getDisputes(@Query('status') status?: 'OPEN' | 'RESOLVED' | 'CLOSED') {
    return this.admin.getDisputes(status);
  }

  @Patch('disputes/:id/resolve')
  resolveDispute(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body('resolutionNote') resolutionNote: string,
    @Body('refundPoster') refundPoster: boolean,
  ) {
    return this.admin.resolveDispute(id, admin.phone, resolutionNote, refundPoster);
  }
}

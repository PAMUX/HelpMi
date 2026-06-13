import { Controller, Get, Patch, Post, Param, Body, Query, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { ApproveKycDto } from './dto/approve-kyc.dto.js';
import { RejectKycDto } from './dto/reject-kyc.dto.js';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto.js';
import { MarkPaidDto } from './dto/mark-paid.dto.js';

type PayoutStatusFilter = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
type RefundStatusFilter = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type TaskStatusFilter =
  | 'PENDING_PAYMENT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @ApiOperation({ summary: 'Dashboard stats' })
  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @ApiOperation({ summary: 'Pending KYC queue' })
  @Get('kyc/pending')
  getPendingKyc() {
    return this.admin.getPendingKyc();
  }

  @ApiOperation({
    summary: 'G-3: short-TTL presigned read URLs for a doer profile’s KYC documents',
  })
  @Get('kyc/:id/documents')
  getKycDocuments(@Param('id') id: string) {
    return this.admin.getKycDocuments(id);
  }

  @ApiOperation({ summary: 'Approve KYC + set tier' })
  @Patch('kyc/:id/approve')
  approveKyc(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: ApproveKycDto,
  ) {
    return this.admin.approveKyc(id, admin.phone, dto.tier);
  }

  @ApiOperation({ summary: 'Reject KYC' })
  @Patch('kyc/:id/reject')
  rejectKyc(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: RejectKycDto,
  ) {
    return this.admin.rejectKyc(id, admin.phone, dto.note);
  }

  @ApiOperation({ summary: 'List users (paginated)' })
  @Get('users')
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getUsers(page ? +page : 1, limit ? +limit : 50);
  }

  @ApiOperation({ summary: 'Ban a user' })
  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.admin.banUser(id);
  }

  @ApiOperation({ summary: 'Unban a user' })
  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.admin.unbanUser(id);
  }

  @ApiOperation({ summary: 'List disputes' })
  @Get('disputes')
  getDisputes(@Query('status') status?: 'OPEN' | 'RESOLVED' | 'CLOSED') {
    return this.admin.getDisputes(status);
  }

  @ApiOperation({ summary: 'Resolve a dispute' })
  @Patch('disputes/:id/resolve')
  resolveDispute(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.admin.resolveDispute(id, admin.phone, dto.resolutionNote, dto.refundPoster);
  }

  @ApiOperation({ summary: 'List payouts' })
  @Get('payouts')
  listPayouts(@Query('status') status?: PayoutStatusFilter) {
    return this.admin.listPayouts(status);
  }

  @ApiOperation({ summary: 'Mark a (bank) payout paid' })
  @Patch('payouts/:id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.admin.markPayoutPaid(id, dto.providerRef);
  }

  @ApiOperation({ summary: 'Export payouts as CSV' })
  @Get('payouts/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payouts.csv"')
  exportPayouts(@Query('status') status?: PayoutStatusFilter) {
    return this.admin.exportPayoutsCsv(status);
  }

  // --- G-1: refund tooling ---

  @ApiOperation({ summary: 'G-1: list refunds (filter by status)' })
  @Get('refunds')
  listRefunds(@Query('status') status?: RefundStatusFilter) {
    return this.admin.listRefunds(status);
  }

  @ApiOperation({ summary: 'G-1: manually initiate a refund for a task’s escrow' })
  @Post('escrows/:taskId/refund')
  initiateEscrowRefund(@Param('taskId') taskId: string, @CurrentUser() admin: JwtPayload) {
    return this.admin.initiateEscrowRefund(taskId, admin.phone);
  }

  @ApiOperation({ summary: 'G-1: retry a PENDING/FAILED refund' })
  @Post('refunds/:id/retry')
  retryRefund(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.admin.retryRefund(id, admin.phone);
  }

  // --- G-2: task recovery ---

  @ApiOperation({ summary: 'G-2: browse tasks (filter by status; includes escrow state)' })
  @Get('tasks')
  listTasks(
    @Query('status') status?: TaskStatusFilter,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listTasks(status, page ? +page : 1, limit ? +limit : 50);
  }

  @ApiOperation({ summary: 'G-2: force-cancel a task (auto-refunds HELD escrow)' })
  @Post('tasks/:id/force-cancel')
  forceCancelTask(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.admin.forceCancelTask(id, admin.phone);
  }
}

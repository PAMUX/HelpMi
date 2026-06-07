import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { NearbyTasksDto } from './dto/nearby-tasks.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';
import { RaiseDisputeDto } from './dto/raise-dispute.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @ApiOperation({ summary: 'Create a task (ESCROW or CASH; starts PENDING_PAYMENT)' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Browse nearby open tasks (tier-filtered)' })
  @Get('nearby')
  findNearby(@Query() dto: NearbyTasksDto, @CurrentUser() user: JwtPayload) {
    return this.tasks.findNearby(dto, user.id);
  }

  @ApiOperation({ summary: 'Tasks I posted' })
  @Get('my/posted')
  getPostedTasks(@CurrentUser() user: JwtPayload) {
    return this.tasks.getPostedTasks(user.id);
  }

  @ApiOperation({ summary: 'Tasks I accepted' })
  @Get('my/accepted')
  getAcceptedTasks(@CurrentUser() user: JwtPayload) {
    return this.tasks.getAcceptedTasks(user.id);
  }

  @ApiOperation({ summary: 'Task detail (participant-aware)' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.findById(id, user.id);
  }

  @ApiOperation({ summary: 'Doer accepts an open task' })
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.accept(id, user.id);
  }

  @ApiOperation({ summary: 'Doer marks task in progress' })
  @Post(':id/start')
  markStarted(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.markStarted(id, user.id);
  }

  @ApiOperation({ summary: 'Doer marks task complete (photo proof)' })
  @Post(':id/complete')
  markComplete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.tasks.markComplete(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Poster confirms completion → releases escrow' })
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.confirm(id, user.id);
  }

  @ApiOperation({ summary: 'Cancel a task' })
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.cancel(id, user.id);
  }

  @ApiOperation({ summary: 'Raise a dispute' })
  @Post(':id/dispute')
  raiseDispute(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.tasks.raiseDispute(id, user.id, dto.reason);
  }
}

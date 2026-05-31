import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { NearbyTasksDto } from './dto/nearby-tasks.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';

@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.id, dto);
  }

  @Get('nearby')
  findNearby(@Query() dto: NearbyTasksDto, @CurrentUser() user: JwtPayload) {
    return this.tasks.findNearby(dto, user.id);
  }

  @Get('my/posted')
  getPostedTasks(@CurrentUser() user: JwtPayload) {
    return this.tasks.getPostedTasks(user.id);
  }

  @Get('my/accepted')
  getAcceptedTasks(@CurrentUser() user: JwtPayload) {
    return this.tasks.getAcceptedTasks(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findById(id);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.accept(id, user.id);
  }

  @Post(':id/start')
  markStarted(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.markStarted(id, user.id);
  }

  @Post(':id/complete')
  markComplete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.tasks.markComplete(id, user.id, dto);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.confirm(id, user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.cancel(id, user.id);
  }

  @Post(':id/dispute')
  raiseDispute(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason: string,
  ) {
    return this.tasks.raiseDispute(id, user.id, reason);
  }
}

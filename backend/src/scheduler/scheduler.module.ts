import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module.js';
import { SchedulerService } from './scheduler.service.js';

@Module({
  imports: [TasksModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

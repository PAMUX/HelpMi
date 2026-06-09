import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { DoerModule } from './doer/doer.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    // G-9: refuse to boot with production-unsafe configuration.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // P2-B: global baseline throttle; auth routes tighten this with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DoerModule,
    CategoriesModule,
    TasksModule,
    PaymentsModule,
    RatingsModule,
    MessagesModule,
    NotificationsModule,
    AdminModule,
    SchedulerModule,
    UploadsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

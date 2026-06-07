"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const prisma_module_js_1 = require("./prisma/prisma.module.js");
const auth_module_js_1 = require("./auth/auth.module.js");
const users_module_js_1 = require("./users/users.module.js");
const doer_module_js_1 = require("./doer/doer.module.js");
const categories_module_js_1 = require("./categories/categories.module.js");
const tasks_module_js_1 = require("./tasks/tasks.module.js");
const payments_module_js_1 = require("./payments/payments.module.js");
const ratings_module_js_1 = require("./ratings/ratings.module.js");
const messages_module_js_1 = require("./messages/messages.module.js");
const notifications_module_js_1 = require("./notifications/notifications.module.js");
const admin_module_js_1 = require("./admin/admin.module.js");
const scheduler_module_js_1 = require("./scheduler/scheduler.module.js");
const uploads_module_js_1 = require("./uploads/uploads.module.js");
const jwt_auth_guard_js_1 = require("./common/guards/jwt-auth.guard.js");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            event_emitter_1.EventEmitterModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
            prisma_module_js_1.PrismaModule,
            auth_module_js_1.AuthModule,
            users_module_js_1.UsersModule,
            doer_module_js_1.DoerModule,
            categories_module_js_1.CategoriesModule,
            tasks_module_js_1.TasksModule,
            payments_module_js_1.PaymentsModule,
            ratings_module_js_1.RatingsModule,
            messages_module_js_1.MessagesModule,
            notifications_module_js_1.NotificationsModule,
            admin_module_js_1.AdminModule,
            scheduler_module_js_1.SchedulerModule,
            uploads_module_js_1.UploadsModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_js_1.JwtAuthGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
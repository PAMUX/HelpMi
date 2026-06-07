"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_js_1 = require("../prisma/prisma.service.js");
const tasks_service_js_1 = require("../tasks/tasks.service.js");
const AUTO_RELEASE_AFTER_HOURS = 24;
let SchedulerService = SchedulerService_1 = class SchedulerService {
    prisma;
    tasks;
    logger = new common_1.Logger(SchedulerService_1.name);
    constructor(prisma, tasks) {
        this.prisma = prisma;
        this.tasks = tasks;
    }
    async autoReleaseEscrows() {
        const cutoff = new Date(Date.now() - AUTO_RELEASE_AFTER_HOURS * 60 * 60 * 1000);
        const due = await this.prisma.task.findMany({
            where: {
                status: 'COMPLETED',
                paymentMode: 'ESCROW',
                confirmedAt: null,
                completedAt: { lte: cutoff },
                escrow: { status: 'HELD' },
            },
            select: { id: true, doerId: true },
        });
        let released = 0;
        for (const task of due) {
            try {
                const didRelease = await this.tasks.releaseEscrow(task.id, task.doerId, { auto: true });
                if (didRelease)
                    released += 1;
            }
            catch (err) {
                this.logger.error(`Auto-release failed for task ${task.id}: ${err.message}`);
            }
        }
        if (due.length > 0) {
            this.logger.log(`Auto-release scan: ${due.length} due, ${released} released`);
        }
        return { scanned: due.length, released };
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "autoReleaseEscrows", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService,
        tasks_service_js_1.TasksService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map
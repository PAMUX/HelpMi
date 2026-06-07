import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';

const AUTO_RELEASE_AFTER_HOURS = 24;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private tasks: TasksService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async autoReleaseEscrows(): Promise<{ scanned: number; released: number }> {
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
        if (didRelease) released += 1;
      } catch (err) {
        this.logger.error(
          `Auto-release failed for task ${task.id}: ${(err as Error).message}`,
        );
      }
    }

    if (due.length > 0) {
      this.logger.log(`Auto-release scan: ${due.length} due, ${released} released`);
    }

    return { scanned: due.length, released };
  }
}

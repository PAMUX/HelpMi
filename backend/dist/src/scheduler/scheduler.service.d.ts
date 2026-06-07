import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
export declare class SchedulerService {
    private prisma;
    private tasks;
    private readonly logger;
    constructor(prisma: PrismaService, tasks: TasksService);
    autoReleaseEscrows(): Promise<{
        scanned: number;
        released: number;
    }>;
}

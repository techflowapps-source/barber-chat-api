import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { LogsRepository } from './logs.repository';

type LogJob = { action: string; payload: Prisma.InputJsonValue };

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    private repo: LogsRepository,
    private queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.registerWorker<LogJob>('logs.persist', (data) => this.persist(data));
  }

  async record(action: string, payload: Record<string, unknown>) {
    try {
      await this.queue.enqueue<LogJob>('logs.persist', {
        action,
        payload: payload as Prisma.InputJsonValue,
      });
    } catch (err) {
      this.logger.warn(`Falha ao enfileirar log ${action}: ${String(err)}`);
      await this.persist({ action, payload: payload as Prisma.InputJsonValue }).catch(() => undefined);
    }
  }

  list(action?: string, take = 100, skip = 0) {
    return this.repo.findMany({ action, take, skip });
  }

  private async persist(data: LogJob) {
    await this.repo.create(data.action, data.payload);
  }
}

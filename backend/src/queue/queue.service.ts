import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis, { Redis, RedisOptions } from 'ioredis';

export type QueueName =
  | 'messages.send'
  | 'messages.media'
  | 'session.reconnect'
  | 'logs.persist'
  | 'appointments.reminder'
  | 'promotions.send';

const DEFAULT_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

function redisConnection(): RedisOptions {
  const url = process.env.REDIS_URL?.trim();
  if (url && (url.startsWith("redis://") || url.startsWith("rediss://"))) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: url.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST ?? "redis",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  };
}

/**
 * Filas BullMQ com Dead Letter Queue por convenção: <name>.dlq.
 * Use registerWorker() para anexar handlers; jobs que esgotam attempts
 * são re-enfileirados na DLQ correspondente.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection = redisConnection();
  private redis!: Redis;
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];
  private events: QueueEvents[] = [];

  onModuleInit() {
    this.redis = new IORedis(this.connection);
  }

  getRedis(): Redis {
    return this.redis;
  }

  async onModuleDestroy() {
    await Promise.all([
      ...this.workers.map((w) => w.close()),
      ...this.events.map((e) => e.close()),
      ...[...this.queues.values()].map((q) => q.close()),
    ]);
    await this.redis?.quit();
  }

  queue(name: QueueName): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, { connection: this.connection, defaultJobOptions: DEFAULT_OPTS }),
      );
      this.queues.set(`${name}.dlq`, new Queue(`${name}.dlq`, { connection: this.connection }));
    }
    return this.queues.get(name)!;
  }

  async enqueue<T>(name: QueueName, data: T, opts?: JobsOptions) {
    return this.queue(name).add(name, data as object, opts);
  }

  registerWorker<T>(
    name: QueueName,
    processor: (data: T) => Promise<unknown>,
    opts?: { concurrency?: number },
  ) {
    const w = new Worker(name, async (job) => processor(job.data as T), {
      connection: this.connection,
      concurrency: opts?.concurrency ?? Number(process.env.QUEUE_CONCURRENCY ?? 5),
    });
    w.on('failed', async (job, err) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        await this.queue(name)
          .client.then(() => this.queues.get(`${name}.dlq`)!.add('dead', { data: job.data, err: err.message }))
          .catch(() => undefined);
        this.logger.error(`Job ${job.id} -> DLQ (${err.message})`);
      }
    });
    this.workers.push(w);
    const ev = new QueueEvents(name, { connection: this.connection });
    this.events.push(ev);
    return w;
  }
}

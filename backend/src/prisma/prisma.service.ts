import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    void this.$connect().catch((err: Error) => {
      this.logger.warn(`Prisma indisponível no boot (${err.message}); API sobe e reconecta sob demanda.`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

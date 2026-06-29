import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsRepository {
  constructor(private prisma: PrismaService) {}

  create(action: string, payload: Prisma.InputJsonValue) {
    return this.prisma.log.create({ data: { action, payload } });
  }

  findMany(params: { action?: string; take?: number; skip?: number }) {
    const { action, take = 100, skip = 0 } = params;
    return this.prisma.log.findMany({
      where: action ? { action } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }
}

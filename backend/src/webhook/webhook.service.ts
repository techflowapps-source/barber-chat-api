import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(private prisma: PrismaService) {}

  list() { return this.prisma.webhookConfig.findMany(); }

  create(data: { event: string; url: string; secret?: string }) {
    return this.prisma.webhookConfig.create({ data });
  }

  remove(id: string) {
    return this.prisma.webhookConfig.delete({ where: { id } });
  }

  /** Dispara o evento para todos os webhooks ativos. */
  async dispatch(event: string, payload: unknown) {
    const targets = await this.prisma.webhookConfig.findMany({ where: { event, active: true } });
    await Promise.allSettled(
      targets.map(async (t) => {
        const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (t.secret) {
          headers['x-signature'] = createHmac('sha256', t.secret).update(body).digest('hex');
        }
        try {
          await fetch(t.url, { method: 'POST', headers, body });
        } catch (e) {
          this.logger.warn(`Webhook ${t.url} falhou: ${(e as Error).message}`);
        }
      }),
    );
  }
}

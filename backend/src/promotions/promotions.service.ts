import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { PromotionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebhookService } from '../webhook/webhook.service';
import { LogsService } from '../logs/logs.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { personalizePromotionMessage } from './promotions.util';

export type PromotionSendJob = {
  promotionId: string;
  phone: string;
  message: string;
  contactName?: string | null;
};

const SEND_INTERVAL_MS = Number(process.env.PROMOTION_SEND_INTERVAL_MS ?? 3_000);

@Injectable()
export class PromotionsService implements OnModuleInit {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private wa: WhatsappService,
    private webhook: WebhookService,
    private logs: LogsService,
  ) {}

  onModuleInit() {
    this.queue.registerWorker<PromotionSendJob>(
      'promotions.send',
      (data) => this.processSend(data),
      { concurrency: 1 },
    );
  }

  list(take = 50) {
    return this.prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async get(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promoção não encontrada');
    return promo;
  }

  /**
   * Cria a promoção e enfileira envio para todos os contatos cadastrados.
   * Use {nome} no texto para personalizar com o nome do cliente.
   */
  async createAndBroadcast(dto: CreatePromotionDto) {
    const contacts = await this.prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (contacts.length === 0) {
      throw new BadRequestException('Nenhum cliente cadastrado para receber a promoção');
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        title: dto.title,
        message: dto.message,
        status: PromotionStatus.QUEUED,
        totalTargets: contacts.length,
      },
    });

    await Promise.all(
      contacts.map((contact, index) =>
        this.queue.enqueue<PromotionSendJob>(
          'promotions.send',
          {
            promotionId: promotion.id,
            phone: contact.phone,
            message: dto.message,
            contactName: contact.nome,
          },
          { delay: index * SEND_INTERVAL_MS, jobId: `${promotion.id}:${contact.phone}` },
        ),
      ),
    );

    await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: { status: PromotionStatus.SENDING },
    });

    await this.logs.record('promotion.created', {
      promotionId: promotion.id,
      title: dto.title,
      totalTargets: contacts.length,
    });

    return {
      ...promotion,
      status: PromotionStatus.SENDING,
      totalTargets: contacts.length,
      hint: `Promoção enfileirada para ${contacts.length} cliente(s)`,
    };
  }

  private personalize(template: string, nome?: string | null) {
    return personalizePromotionMessage(template, nome);
  }

  private async processSend({ promotionId, phone, message, contactName }: PromotionSendJob) {
    const text = this.personalize(message, contactName);

    try {
      await this.wa.sendText(phone, text);
      await this.prisma.promotion.update({
        where: { id: promotionId },
        data: { sentCount: { increment: 1 } },
      });
      await this.webhook.dispatch('promotion.sent', { promotionId, phone });
    } catch (err) {
      await this.prisma.promotion.update({
        where: { id: promotionId },
        data: { failedCount: { increment: 1 } },
      });
      this.logger.error(`Falha ao enviar promoção ${promotionId} para ${phone}`, err as Error);
      throw err;
    } finally {
      await this.checkCompletion(promotionId);
    }
  }

  private async checkCompletion(promotionId: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promo || promo.status === PromotionStatus.COMPLETED || promo.status === PromotionStatus.FAILED) {
      return;
    }

    const processed = promo.sentCount + promo.failedCount;
    if (processed < promo.totalTargets) return;

    const status =
      promo.sentCount === 0 ? PromotionStatus.FAILED : PromotionStatus.COMPLETED;

    await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { status, completedAt: new Date() },
    });

    await this.webhook.dispatch('promotion.completed', {
      promotionId,
      sentCount: promo.sentCount,
      failedCount: promo.failedCount,
    });
    await this.logs.record('promotion.completed', { promotionId, status });
  }
}

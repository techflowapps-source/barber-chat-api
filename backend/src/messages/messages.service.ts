import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { QueueService } from '../queue/queue.service';
import { LogsService } from '../logs/logs.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMediaDto } from './dto/send-media.dto';
import { SendLocationDto } from './dto/send-location.dto';
import { SendContactDto } from './dto/send-contact.dto';
import { SendListDto } from './dto/send-list.dto';
import { SendButtonsDto } from './dto/send-buttons.dto';
import { SendReactionDto } from './dto/send-reaction.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MediaType, MessageStatus, Prisma } from '@prisma/client';
import { proto } from '@whiskeysockets/baileys';

type SendTextJob = { phone: string; message: string };
type SendMediaJob = {
  kind: 'image' | 'audio' | 'document';
  phone: string;
  url: string;
  caption?: string;
  fileName?: string;
};

@Injectable()
export class MessagesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private queue: QueueService,
    private logs: LogsService,
  ) {}

  onModuleInit() {
    this.queue.registerWorker<SendTextJob>('messages.send', (data) => this.processSendText(data));
    this.queue.registerWorker<SendMediaJob>('messages.media', (data) => this.processSendMedia(data));
  }

  list(remoteJid?: string, take = 50) {
    return this.prisma.message.findMany({
      where: remoteJid ? { remoteJid } : undefined,
      orderBy: { timestamp: 'desc' },
      take,
    });
  }

  conversations(take = 50) {
    return this.prisma.$queryRaw<
      { remoteJid: string; lastMessage: string; lastAt: Date; total: bigint }[]
    >`
      SELECT "remoteJid",
             (ARRAY_AGG("message" ORDER BY "timestamp" DESC))[1] AS "lastMessage",
             MAX("timestamp") AS "lastAt",
             COUNT(*)::bigint AS total
      FROM "Message"
      GROUP BY "remoteJid"
      ORDER BY MAX("timestamp") DESC
      LIMIT ${take}
    `;
  }

  async sendText(dto: SendMessageDto) {
    const job = await this.queue.enqueue<SendTextJob>('messages.send', {
      phone: dto.phone,
      message: dto.message,
    });
    await this.logs.record('message.send.queued', { phone: dto.phone, jobId: job.id });
    return { queued: true, jobId: job.id };
  }

  async sendMedia(kind: 'image' | 'audio' | 'document', dto: SendMediaDto) {
    const job = await this.queue.enqueue<SendMediaJob>(
      'messages.media',
      { kind, phone: dto.phone, url: dto.url, caption: dto.caption, fileName: dto.fileName },
    );
    return { queued: true, jobId: job.id };
  }

  async sendLocation(dto: SendLocationDto) {
    await this.wa.sendLocation(dto.phone, dto.lat, dto.lng, dto.name);
    return this.persistOutbound(dto.phone, dto.name ?? '[localização]', MediaType.LOCATION);
  }

  async sendContact(dto: SendContactDto) {
    await this.wa.sendContact(dto.phone, dto.displayName, dto.vcard);
    return this.persistOutbound(dto.phone, dto.displayName, MediaType.CONTACT);
  }

  async sendList(dto: SendListDto) {
    await this.wa.sendList(dto.phone, {
      text: dto.text,
      buttonText: dto.buttonText,
      sections: dto.sections,
    });
    return this.persistOutbound(dto.phone, dto.text, MediaType.TEXT);
  }

  async sendButtons(dto: SendButtonsDto) {
    await this.wa.sendButtons(dto.phone, { text: dto.text, buttons: dto.buttons });
    return this.persistOutbound(dto.phone, dto.text, MediaType.TEXT);
  }

  async sendReaction(dto: SendReactionDto) {
    await this.wa.sendReaction(dto.phone, dto.key as proto.IMessageKey, dto.emoji);
    return this.persistOutbound(dto.phone, dto.emoji, MediaType.REACTION);
  }

  async markRead(dto: MarkReadDto) {
    await this.wa.markRead(dto.key as proto.IMessageKey);
    await this.logs.record('message.read', { key: dto.key as Prisma.InputJsonValue });
    return { ok: true };
  }

  private async processSendText(data: SendTextJob) {
    await this.wa.sendText(data.phone, data.message);
    const msg = await this.persistOutbound(data.phone, data.message, MediaType.TEXT);
    await this.logs.record('message.sent', { id: msg.id, phone: data.phone });
    return msg;
  }

  private async processSendMedia(data: SendMediaJob) {
    switch (data.kind) {
      case 'image':
        await this.wa.sendImage(data.phone, data.url, data.caption);
        break;
      case 'audio':
        await this.wa.sendAudio(data.phone, data.url);
        break;
      case 'document':
        await this.wa.sendDocument(data.phone, data.url, data.fileName ?? 'arquivo.pdf');
        break;
    }
    return this.persistOutbound(
      data.phone,
      data.caption ?? `[${data.kind}]`,
      data.kind.toUpperCase() as MediaType,
      data.url,
    );
  }

  private persistOutbound(phone: string, message: string, mediaType: MediaType, mediaUrl?: string) {
    return this.prisma.message.create({
      data: {
        remoteJid: this.wa.jidOf(phone),
        fromMe: true,
        message,
        mediaType,
        mediaUrl: mediaUrl ?? null,
        status: MessageStatus.SENT,
      },
    });
  }
}

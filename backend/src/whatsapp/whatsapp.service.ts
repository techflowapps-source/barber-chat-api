import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
} from '@nestjs/common';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { join } from 'path';
import { SessionStatus, MessageStatus, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { ChatbotService } from './chatbot.service';
import { QueueService } from '../queue/queue.service';
import { LogsService } from '../logs/logs.service';

type ReconnectJob = { sessionName: string; attempt: number };

/**
 * Sessão única do WhatsApp (single-tenant).
 * Persistência em ./sessions/<WA_SESSION_NAME> via useMultiFileAuthState,
 * o que mantém a sessão viva entre reinícios do container.
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock?: WASocket;
  private qr?: string;
  private readonly sessionName = process.env.WA_SESSION_NAME ?? 'barbershop-main';
  private readonly sessionDir = process.env.WA_SESSION_DIR ?? './sessions';
  private reconnectAttempts = 0;

  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
    private webhook: WebhookService,
    private chatbot: ChatbotService,
    private queue: QueueService,
    private logs: LogsService,
  ) {}

  async onModuleInit() {
    this.queue.registerWorker<ReconnectJob>('session.reconnect', (data) =>
      this.processReconnect(data),
    );
    // Conexão WhatsApp é iniciada pelo painel (POST /session/connect), não no boot.
  }

  async onModuleDestroy() {
    this.sock?.end(undefined);
  }

  getSocket(): WASocket {
    if (!this.sock) throw new BadRequestException('Sessão não conectada');
    return this.sock;
  }

  async getStatus() {
    const row = await this.prisma.whatsappSession.findUnique({
      where: { sessionName: this.sessionName },
    });
    return row;
  }

  async getQrCode() {
    if (!this.qr) return { qr: null, dataUrl: null };
    const dataUrl = await QRCode.toDataURL(this.qr);
    return { qr: this.qr, dataUrl };
  }

  async connect() {
    const current = await this.getStatus();
    const active = current?.sessionStatus;
    if (
      this.sock &&
      (active === SessionStatus.CONNECTED ||
        active === SessionStatus.CONNECTING ||
        active === SessionStatus.QR)
    ) {
      return;
    }

    if (this.sock) {
      this.sock.end(undefined);
      this.sock = undefined;
    }
    this.qr = undefined;

    const { state, saveCreds } = await useMultiFileAuthState(
      join(this.sessionDir, this.sessionName),
    );
    const { version } = await fetchLatestBaileysVersion();
    this.sock = makeWASocket({ version, auth: state, printQRInTerminal: false });
    await this.updateStatus(SessionStatus.CONNECTING);
    await this.logs.record('session.connecting', { sessionName: this.sessionName });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (u) => this.handleConnectionUpdate(u));
    this.sock.ev.on('messages.upsert', (u) => this.handleMessages(u));
    this.sock.ev.on('messages.update', (u) => this.handleMessagesUpdate(u));
    this.sock.ev.on('messages.delete', (d) => this.handleMessagesDelete(d));
    this.sock.ev.on('presence.update', (p) => this.handlePresence(p));
  }

  async disconnect() {
    await this.sock?.logout();
    this.sock = undefined;
    this.qr = undefined;
    await this.updateStatus(SessionStatus.DISCONNECTED);
    this.gateway.emit('session.disconnected', { sessionName: this.sessionName });
    await this.webhook.dispatch('session.disconnected', { sessionName: this.sessionName });
    await this.logs.record('session.disconnected', { sessionName: this.sessionName });
  }

  async reconnect() {
    this.sock?.end(undefined);
    this.sock = undefined;
    await this.connect();
  }

  private async processReconnect({ attempt }: ReconnectJob) {
    this.reconnectAttempts = attempt;
    await this.logs.record('session.reconnect', { attempt });
    await this.connect();
  }

  private scheduleReconnect() {
    const attempt = this.reconnectAttempts + 1;
    const delay = Math.min(30_000, 2_000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts = attempt;
    void this.queue.enqueue<ReconnectJob>(
      'session.reconnect',
      { sessionName: this.sessionName, attempt },
      { delay },
    );
  }

  private async handleConnectionUpdate(u: {
    connection?: string;
    lastDisconnect?: { error?: Error };
    qr?: string;
  }) {
    if (u.qr) {
      this.qr = u.qr;
      await this.updateStatus(SessionStatus.QR, { qrCode: u.qr });
      this.gateway.emit('qr.updated', { qr: u.qr });
      await this.webhook.dispatch('qr.updated', { sessionName: this.sessionName });
    }

    if (u.connection === 'open') {
      this.reconnectAttempts = 0;
      this.qr = undefined;
      const me = this.sock?.user;
      await this.updateStatus(SessionStatus.CONNECTED, {
        phone: me?.id?.split(':')[0] ?? null,
        profileName: me?.name ?? null,
        connectedAt: new Date(),
        qrCode: null,
      });
      this.gateway.emit('session.connected', { user: me });
      await this.webhook.dispatch('session.connected', { user: me });
      await this.logs.record('session.connected', { phone: me?.id });
    }

    if (u.connection === 'close') {
      const code = (u.lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      const status = loggedOut ? SessionStatus.DISCONNECTED : SessionStatus.FAILED;
      await this.updateStatus(status);
      this.sock = undefined;

      if (loggedOut) {
        this.gateway.emit('session.disconnected', { code, loggedOut });
        await this.webhook.dispatch('session.disconnected', { code, loggedOut });
      } else {
        this.gateway.emit('session.failed', { code });
        await this.webhook.dispatch('session.failed', { code });
        this.logger.warn(`Sessão falhou (code=${code}), agendando reconexão...`);
        this.scheduleReconnect();
      }
      await this.logs.record(loggedOut ? 'session.disconnected' : 'session.failed', { code });
    }
  }

  private async handleMessages(u: { messages: proto.IWebMessageInfo[]; type: string }) {
    for (const m of u.messages) {
      if (!m.message || !m.key.remoteJid) continue;
      const text =
        m.message.conversation ??
        m.message.extendedTextMessage?.text ??
        '[mídia]';
      const fromMe = !!m.key.fromMe;

      const phone = m.key.remoteJid.split('@')[0];
      if (!fromMe) {
        await this.prisma.contact.upsert({
          where: { phone },
          update: {},
          create: { phone },
        });
      }

      const saved = await this.prisma.message.create({
        data: {
          remoteJid: m.key.remoteJid,
          fromMe,
          message: text,
          mediaType: MediaType.TEXT,
          status: fromMe ? MessageStatus.SENT : MessageStatus.DELIVERED,
        },
      });

      this.gateway.emit(fromMe ? 'message.sent' : 'message.received', saved);
      await this.webhook.dispatch(fromMe ? 'message.sent' : 'message.received', saved);
      if (!fromMe) await this.webhook.dispatch('message.delivered', saved);

      if (!fromMe) await this.chatbot.handle(this, m.key.remoteJid, text);
    }
  }

  private async handleMessagesUpdate(
    updates: { key: proto.IMessageKey; update: Partial<proto.IWebMessageInfo> }[],
  ) {
    for (const u of updates) {
      const status = u.update.status;
      if (status === 3) {
        await this.prisma.message.updateMany({
          where: { remoteJid: u.key.remoteJid ?? '', fromMe: true },
          data: { status: MessageStatus.DELIVERED },
        });
        this.gateway.emit('message.sent', u.key);
        await this.webhook.dispatch('message.delivered', u.key);
      }
      if (status === 4) {
        await this.prisma.message.updateMany({
          where: { remoteJid: u.key.remoteJid ?? '' },
          data: { status: MessageStatus.READ },
        });
        this.gateway.emit('message.read', u.key);
        await this.webhook.dispatch('message.read', u.key);
      }
    }
  }

  private handleMessagesDelete(item: { keys: proto.IMessageKey[] } | { jid: string; all: true }) {
    if (!('keys' in item)) return;
    for (const key of item.keys) {
      this.gateway.emit('message.deleted', key);
      void this.webhook.dispatch('message.deleted', key);
    }
  }

  private handlePresence(p: { id: string; presences: Record<string, { lastKnownPresence?: string }> }) {
    this.gateway.emit('presence.update', p);
    for (const [, presence] of Object.entries(p.presences)) {
      if (presence.lastKnownPresence === 'composing') {
        this.gateway.emit('typing.start', { id: p.id });
      } else if (presence.lastKnownPresence === 'paused') {
        this.gateway.emit('typing.stop', { id: p.id });
      }
    }
  }

  private async updateStatus(
    status: SessionStatus,
    extra: Partial<{
      phone: string | null;
      profileName: string | null;
      profilePhoto: string | null;
      qrCode: string | null;
      connectedAt: Date;
    }> = {},
  ) {
    await this.prisma.whatsappSession.upsert({
      where: { sessionName: this.sessionName },
      create: { sessionName: this.sessionName, sessionStatus: status, ...extra },
      update: { sessionStatus: status, lastHeartbeat: new Date(), ...extra },
    });
  }

  jidOf(phone: string) {
    return phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  async sendText(phone: string, text: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), { text });
  }
  async sendImage(phone: string, url: string, caption?: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), { image: { url }, caption });
  }
  async sendAudio(phone: string, url: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), { audio: { url }, mimetype: 'audio/mp4', ptt: true });
  }
  async sendDocument(phone: string, url: string, fileName: string, mimetype = 'application/pdf') {
    return this.getSocket().sendMessage(this.jidOf(phone), { document: { url }, fileName, mimetype });
  }
  async sendLocation(phone: string, lat: number, lng: number, name?: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), {
      location: { degreesLatitude: lat, degreesLongitude: lng, name },
    });
  }
  async sendContact(phone: string, displayName: string, vcard: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), {
      contacts: { displayName, contacts: [{ vcard }] },
    });
  }
  async sendList(phone: string, payload: { text: string; buttonText: string; sections: unknown[] }) {
    return this.getSocket().sendMessage(this.jidOf(phone), payload as never);
  }
  async sendButtons(phone: string, payload: { text: string; buttons: unknown[] }) {
    return this.getSocket().sendMessage(this.jidOf(phone), payload as never);
  }
  async sendReaction(phone: string, key: proto.IMessageKey, emoji: string) {
    return this.getSocket().sendMessage(this.jidOf(phone), { react: { text: emoji, key } });
  }
  async markRead(key: proto.IMessageKey) {
    return this.getSocket().readMessages([key]);
  }

  async checkNumber(phone: string) {
    const result = await this.getSocket().onWhatsApp(this.jidOf(phone));
    const r = result?.[0];
    return { exists: !!r?.exists, jid: r?.jid };
  }
  async profilePicture(phone: string) {
    try {
      return { url: await this.getSocket().profilePictureUrl(this.jidOf(phone), 'image') };
    } catch {
      return { url: null };
    }
  }
  async contactName(phone: string) {
    const jid = this.jidOf(phone);
    const store = (this.getSocket() as unknown as {
      contacts?: Record<string, { name?: string; notify?: string }>;
    }).contacts;
    return { name: store?.[jid]?.name ?? store?.[jid]?.notify ?? null };
  }
  async listGroups() {
    return this.getSocket().groupFetchAllParticipating();
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebhookService } from '../webhook/webhook.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

type ReminderJob = { appointmentId: string; kind: '15m' };

const REMINDER_MINUTES = Number(process.env.APPOINTMENT_REMINDER_MINUTES ?? 15);

@Injectable()
export class AppointmentsService implements OnModuleInit {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private wa: WhatsappService,
    private webhook: WebhookService,
    private gateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.queue.registerWorker<ReminderJob>('appointments.reminder', (data) =>
      this.processReminder(data),
    );
  }

  async list(params: { from?: string; to?: string; status?: AppointmentStatus; contactId?: string }) {
    const where: Prisma.AppointmentWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.contactId) where.contactId = params.contactId;
    if (params.from || params.to) {
      where.startsAt = {};
      if (params.from) (where.startsAt as Prisma.DateTimeFilter).gte = new Date(params.from);
      if (params.to) (where.startsAt as Prisma.DateTimeFilter).lte = new Date(params.to);
    }
    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: { contact: true },
      take: 200,
    });
  }

  async get(id: string) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    return a;
  }

  async create(dto: CreateAppointmentDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('endsAt deve ser maior que startsAt');

    const phone = dto.phone.replace(/\D/g, '');
    const contact = await this.prisma.contact.upsert({
      where: { phone },
      update: dto.nome ? { nome: dto.nome } : {},
      create: { phone, nome: dto.nome },
    });

    const appt = await this.prisma.appointment.create({
      data: {
        contactId: contact.id,
        barberId: dto.barberId,
        service: dto.service,
        startsAt,
        endsAt,
        notes: dto.notes,
      },
      include: { contact: true },
    });

    await this.scheduleReminder(appt.id, startsAt);
    this.gateway.emit('appointment.created', appt);
    await this.webhook.dispatch('appointment.created', appt);

    const when = startsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const confirmMsg =
      `✅ Agendamento confirmado!\n\n` +
      `Serviço: *${appt.service}*\n` +
      `Data/hora: ${when}\n\n` +
      `Você receberá um lembrete ${REMINDER_MINUTES} minutos antes do horário.`;
    await this.notifyContact(appt.contact.phone, confirmMsg, 'appointment.confirmation', appt.id);

    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const current = await this.get(id);
    const data: Prisma.AppointmentUpdateInput = { ...dto } as Prisma.AppointmentUpdateInput;
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) data.endsAt = new Date(dto.endsAt);

    const appt = await this.prisma.appointment.update({
      where: { id },
      data,
      include: { contact: true },
    });

    if (dto.startsAt && new Date(dto.startsAt).getTime() !== current.startsAt.getTime()) {
      await this.prisma.appointment.update({
        where: { id },
        data: { reminded15m: false },
      });
      await this.scheduleReminder(id, new Date(dto.startsAt));
    }

    this.gateway.emit('appointment.updated', appt);
    await this.webhook.dispatch('appointment.updated', appt);

    if (dto.startsAt && new Date(dto.startsAt).getTime() !== current.startsAt.getTime()) {
      const when = new Date(dto.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      await this.notifyContact(
        appt.contact.phone,
        `📅 Seu agendamento de *${appt.service}* foi reagendado para ${when}.`,
        'appointment.rescheduled',
        appt.id,
      );
    }

    return appt;
  }

  async cancel(id: string) {
    const appt = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: { contact: true },
    });
    this.gateway.emit('appointment.cancelled', appt);
    await this.webhook.dispatch('appointment.cancelled', appt);

    const when = appt.startsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await this.notifyContact(
      appt.contact.phone,
      `❌ Seu agendamento de *${appt.service}* em ${when} foi cancelado.`,
      'appointment.cancelled_notify',
      appt.id,
    );

    return appt;
  }

  private async notifyContact(phone: string, message: string, action: string, appointmentId: string) {
    try {
      await this.wa.sendText(phone, message);
      await this.webhook.dispatch('message.sent', { phone, message, appointmentId });
    } catch (err) {
      this.logger.error(`Falha ao notificar ${phone} (${action})`, err as Error);
    }
  }

  private async scheduleReminder(appointmentId: string, startsAt: Date) {
    const delayMs = startsAt.getTime() - REMINDER_MINUTES * 60_000 - Date.now();
    if (delayMs <= 0) return;

    await this.queue.enqueue<ReminderJob>(
      'appointments.reminder',
      { appointmentId, kind: '15m' },
      { delay: delayMs, jobId: `${appointmentId}:15m` },
    );
  }

  private async processReminder({ appointmentId }: ReminderJob) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { contact: true },
    });
    if (!appt) return;
    if (appt.status === AppointmentStatus.CANCELLED || appt.status === AppointmentStatus.COMPLETED) return;
    if (appt.reminded15m) return;

    const when = appt.startsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const nome = appt.contact.nome ? `${appt.contact.nome}, ` : '';
    const msg =
      `⏰ ${nome}falta apenas *${REMINDER_MINUTES} minutos* para começar o serviço ` +
      `*${appt.service}* agendado para ${when}.\n\nTe esperamos! 💈`;

    try {
      await this.wa.sendText(appt.contact.phone, msg);
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { reminded15m: true },
      });
      await this.webhook.dispatch('appointment.reminded', { appointmentId, kind: '15m' });
    } catch (err) {
      this.logger.error(`Falha ao enviar lembrete 15m para ${appointmentId}`, err as Error);
      throw err;
    }
  }
}

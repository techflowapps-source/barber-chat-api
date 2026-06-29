import { Injectable } from '@nestjs/common';

/** Chatbot mínimo. Substitua por um motor de intents quando necessário. */
@Injectable()
export class ChatbotService {
  async handle(wa: { sendText: (p: string, t: string) => Promise<unknown> }, jid: string, text: string) {
    const t = text.toLowerCase().trim();
    if (/(menu|opções|opcoes)/.test(t)) {
      return wa.sendText(jid,
        'Olá! 👋\n1️⃣ Agendar horário\n2️⃣ Ver meus agendamentos\n3️⃣ Falar com atendente');
    }
    if (/(agendar|marcar)/.test(t)) {
      return wa.sendText(jid, 'Perfeito! Envie data e horário desejados (ex: 30/06 às 15h).');
    }
    if (/(cancelar)/.test(t)) {
      return wa.sendText(jid, 'Para cancelar, informe o ID do agendamento.');
    }
    return null;
  }
}

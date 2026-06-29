# Barbershop WhatsApp API

API REST em **NestJS + TypeScript + Prisma + PostgreSQL + Redis + Baileys** para integrar o
agendamento de uma barbearia ao WhatsApp (sessão única, QR Code, envio/recebimento, webhooks,
WebSocket em tempo real e filas com retry/DLQ).

> Arquitetura preparada para evoluir para multi-tenant, mas esta v1 opera com **uma única sessão**.

---

## Stack

Node.js LTS · NestJS 10 · TypeScript · Prisma · PostgreSQL 16 · Redis 7 · BullMQ · Baileys
(`@whiskeysockets/baileys`) · JWT + Refresh Token · Swagger · WebSocket (`@nestjs/websockets`) ·
Winston · Helmet · `@nestjs/throttler` · class-validator · Docker / Docker Compose.

## Arquitetura

Clean Architecture / SOLID:

```
src/
├── auth/           # Login, refresh, JWT strategy, guards, roles
├── users/          # CRUD de usuários (ADMIN / BARBEIRO)
├── whatsapp/       # Sessão Baileys, conexão, QR, reconexão
├── messages/       # Envio (texto, imagem, áudio, doc, localização, contato, lista, botões, reação)
├── contacts/       # Contatos, grupos, foto de perfil, verificação de número
├── webhook/        # Webhooks configuráveis de saída
├── logs/           # Auditoria
├── websocket/      # Gateway de eventos em tempo real
├── health/         # /health
├── queue/          # BullMQ: envio, mídia, reconexão, logs, DLQ
├── prisma/         # PrismaService
├── common/         # Filters, interceptors, decorators, pipes, utils
└── config/         # env, winston, swagger, throttler
```

## Como rodar

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed   # cria admin padrão
```

API: <http://localhost:3000>  ·  Swagger: <http://localhost:3000/docs>  ·  WS: `ws://localhost:3000`

## Integração com o sistema de agendamento

Endpoints internos permitem que o módulo de agendamento dispare:

- Confirmação automática de agendamento
- **Lembrete 15 minutos antes** do horário (configurável via `APPOINTMENT_REMINDER_MINUTES`)
- Aviso de cancelamento / reagendamento
- **Promoções em massa** para todos os clientes cadastrados (`POST /api/promotions`, ADMIN)
- Chatbot básico (intents simples em `whatsapp/chatbot.service.ts`)
- Mensagens personalizadas pelo painel admin

A sessão é persistida em `./sessions/` (volume Docker) — sobrevive a reinicializações.

## Eventos WebSocket

`qr.updated` · `session.connected` · `session.disconnected` · `session.failed`
· `message.received` · `message.sent` · `message.read` · `message.deleted`
· `typing.start` · `typing.stop` · `presence.update`

## Segurança

JWT (access + refresh) · Helmet · CORS allow-list · Throttler (rate-limit global + por IP)
· ValidationPipe (whitelist + forbidNonWhitelisted) · bcrypt para senha · brute-force guard
no `/auth/login` (lockout temporário em Redis) · sanitização de payload.

## Filas (BullMQ)

| Queue              | Worker                       | Retry | DLQ |
| ------------------ | ---------------------------- | ----- | --- |
| `messages.send`    | envio de mensagens           | 5x    | sim |
| `messages.media`   | upload / download de mídia   | 3x    | sim |
| `session.reconnect`| reconexão automática         | ∞     | —   |
| `logs.persist`     | persistência de logs         | 3x    | sim |

## Testes

```bash
npm run test           # unit
npm run test:e2e       # integração
```

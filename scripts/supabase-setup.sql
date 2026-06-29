-- =============================================================================
-- Barber Chat API — setup completo no Supabase SQL Editor
-- Dashboard > SQL Editor > New query > cole tudo e clique Run
--
-- Use em banco VAZIO. Se já rodou parte, execute só o bloco que faltar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE 1: Schema (tabelas, enums, índices)
-- -----------------------------------------------------------------------------

CREATE TYPE "Role" AS ENUM ('ADMIN', 'BARBEIRO');
CREATE TYPE "SessionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR', 'CONNECTED', 'FAILED');
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "MediaType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION', 'CONTACT', 'STICKER', 'REACTION');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "PromotionStatus" AS ENUM ('QUEUED', 'SENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BARBEIRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "phone" TEXT,
    "profileName" TEXT,
    "profilePhoto" TEXT,
    "sessionStatus" "SessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nome" TEXT,
    "foto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "barberId" TEXT,
    "service" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "reminded15m" BOOLEAN NOT NULL DEFAULT false,
    "reminded24h" BOOLEAN NOT NULL DEFAULT false,
    "reminded1h" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'QUEUED',
    "totalTargets" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE UNIQUE INDEX "WhatsappSession_sessionName_key" ON "WhatsappSession"("sessionName");
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");
CREATE INDEX "Appointment_startsAt_status_idx" ON "Appointment"("startsAt", "status");
CREATE INDEX "Appointment_contactId_startsAt_idx" ON "Appointment"("contactId", "startsAt");
CREATE INDEX "Message_remoteJid_timestamp_idx" ON "Message"("remoteJid", "timestamp");
CREATE INDEX "Log_action_createdAt_idx" ON "Log"("action", "createdAt");
CREATE UNIQUE INDEX "WebhookConfig_event_url_key" ON "WebhookConfig"("event", "url");
CREATE INDEX "Promotion_status_createdAt_idx" ON "Promotion"("status", "createdAt");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- PARTE 2: Admin + sessão WhatsApp
-- Login: barbershoppaiva@gmail.com / Paiva@2026DL
-- -----------------------------------------------------------------------------

INSERT INTO "User" ("id", "nome", "email", "senhaHash", "role", "createdAt")
VALUES (
    gen_random_uuid()::text,
    'Admin Paiva',
    'barbershoppaiva@gmail.com',
    '$2b$10$zm7ZTu0dqU4kAsidIaF9E.Nm9/YdbiGQCggqUknlu8tyXtTQcm7cG',
    'ADMIN',
    NOW()
)
ON CONFLICT ("email") DO UPDATE SET
    "nome" = EXCLUDED."nome",
    "senhaHash" = EXCLUDED."senhaHash",
    "role" = EXCLUDED."role";

INSERT INTO "WhatsappSession" ("id", "sessionName", "sessionStatus", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'barbershop-main',
    'DISCONNECTED',
    NOW(),
    NOW()
)
ON CONFLICT ("sessionName") DO NOTHING;

-- -----------------------------------------------------------------------------
-- PARTE 3 (opcional): registrar migrations do Prisma
-- Rode só se for usar "prisma migrate deploy" depois
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '5c296f4f3f776bb5cd44f37179bbb20b1b5de2cf7328f0cbe6c80b53ffe95d93', NOW(), '20250629000000_init', NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20250629000000_init');

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '56ce10e10879273261a4569798bf1cf7b5353d7ab85048316249787f6b61b976', NOW(), '20250629120000_reminder_15m_and_promotions', NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20250629120000_reminder_15m_and_promotions');

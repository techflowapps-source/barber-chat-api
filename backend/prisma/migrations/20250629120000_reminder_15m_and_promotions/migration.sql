-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "reminded15m" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('QUEUED', 'SENDING', 'COMPLETED', 'FAILED');

-- CreateTable
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

-- CreateIndex
CREATE INDEX "Promotion_status_createdAt_idx" ON "Promotion"("status", "createdAt");

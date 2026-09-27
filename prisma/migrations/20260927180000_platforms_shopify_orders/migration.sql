-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('youtube', 'instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('pending', 'publishing', 'reconciling', 'simulated', 'published', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderKey" ADD VALUE 'instagram';
ALTER TYPE "ProviderKey" ADD VALUE 'tiktok';

-- AlterTable
ALTER TABLE "ChannelSystem" ADD COLUMN     "shortPlatforms" "Platform"[] DEFAULT ARRAY['youtube']::"Platform"[];

-- AlterTable
ALTER TABLE "ContentVersion" ADD COLUMN     "caption" TEXT;

-- CreateTable
CREATE TABLE "PublicationTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "mode" "PublicationMode" NOT NULL,
    "status" "TargetStatus" NOT NULL DEFAULT 'pending',
    "providerPostId" TEXT,
    "providerUploadId" TEXT,
    "url" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "email" TEXT NOT NULL,
    "plan" "PlanKey" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "organizationId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationTarget_organizationId_idx" ON "PublicationTarget"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationTarget_publicationId_platform_key" ON "PublicationTarget"("publicationId", "platform");

-- CreateIndex
CREATE INDEX "ShopifyOrder_email_status_idx" ON "ShopifyOrder"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrder_shopDomain_orderId_key" ON "ShopifyOrder"("shopDomain", "orderId");

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTarget" ADD CONSTRAINT "PublicationTarget_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyOrder" ADD CONSTRAINT "ShopifyOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Datenübernahme: Bisher gab es nur YouTube. Jede bestehende Veröffentlichung erhält ein YouTube-Ziel
-- mit übernommenem Status, damit Abgleich und Anzeige unverändert weiterlaufen.
INSERT INTO "PublicationTarget" ("id", "organizationId", "publicationId", "platform", "mode", "status", "providerPostId", "attempt", "lastError", "publishedAt", "createdAt", "updatedAt")
SELECT 'pt_' || p."id", p."organizationId", p."id", 'youtube', p."mode",
       (CASE p."status"::text WHEN 'scheduled' THEN 'pending' WHEN 'held' THEN 'pending' WHEN 'cancelled' THEN 'pending' ELSE p."status"::text END)::"TargetStatus",
       p."providerVideoId", p."attempt", p."lastError", p."publishedAt", p."createdAt", CURRENT_TIMESTAMP
  FROM "Publication" p;

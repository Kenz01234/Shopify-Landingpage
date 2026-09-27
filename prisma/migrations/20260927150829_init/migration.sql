-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('customer', 'admin');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "PlanKey" AS ENUM ('starter', 'studio');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('incomplete', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "BillingProviderKey" AS ENUM ('demo', 'stripe', 'shopify');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('longform', 'short');

-- CreateEnum
CREATE TYPE "QuotaAction" AS ENUM ('reserve', 'consume', 'release');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ReviewMode" AS ENUM ('final_only', 'topic_and_final', 'script_and_final');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('draft', 'queued', 'researching', 'awaiting_topic_approval', 'scripting', 'awaiting_script_approval', 'voiceover', 'rendering', 'quality_check', 'awaiting_approval', 'changes_requested', 'approved', 'scheduled', 'held', 'publishing', 'reconciling', 'published', 'retry_scheduled', 'failed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "JobOrigin" AS ENUM ('schedule', 'manual');

-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('topic', 'script', 'final');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('video', 'short', 'audio', 'thumbnail');

-- CreateEnum
CREATE TYPE "RightsStatus" AS ENUM ('own_production', 'demo_fixture', 'licensed', 'public_domain', 'unknown', 'needs_review');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'changes_requested', 'rejected');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('scheduled', 'held', 'publishing', 'reconciling', 'simulated', 'published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PublicationMode" AS ENUM ('simulated', 'live');

-- CreateEnum
CREATE TYPE "ProviderKey" AS ENUM ('youtube', 'n8n', 'elevenlabs', 'telegram');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('demo', 'connected', 'not_connected', 'error', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'customer',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoClockOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "PlanKey" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "provider" "BillingProviderKey" NOT NULL DEFAULT 'demo',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "pendingPlan" "PlanKey",
    "demoFailNextRenewal" BOOLEAN NOT NULL DEFAULT false,
    "lastProviderEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaCounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "limit" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "jobId" TEXT,
    "format" "ContentFormat" NOT NULL,
    "action" "QuotaAction" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSystem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "topics" TEXT[],
    "audience" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "tone" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "voiceKey" TEXT NOT NULL,
    "voiceLabel" TEXT NOT NULL,
    "longformEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shortsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "longformPerPeriod" INTEGER NOT NULL,
    "longformMinutes" INTEGER NOT NULL,
    "shortsPerPeriod" INTEGER NOT NULL,
    "shortSeconds" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "reviewMode" "ReviewMode" NOT NULL DEFAULT 'final_only',
    "status" "SystemStatus" NOT NULL DEFAULT 'active',
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "youtubeConnectionId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceChannel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "weekday" INTEGER NOT NULL,
    "localTime" TEXT NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "origin" "JobOrigin" NOT NULL,
    "demoScenario" TEXT NOT NULL DEFAULT 'success',
    "configVersion" INTEGER NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "targetSlotAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "topic" TEXT,
    "workingData" JSONB NOT NULL DEFAULT '{}',
    "retryStep" "JobStatus",
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "failedStep" "JobStatus",
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "revisionNote" TEXT,
    "cancelReason" TEXT,
    "externalRunId" TEXT,
    "externalAcceptedAt" TIMESTAMP(3),
    "lastExternalSeq" INTEGER NOT NULL DEFAULT 0,
    "currentVersionId" TEXT,
    "quotaState" TEXT NOT NULL DEFAULT 'none',
    "quotaCounterId" TEXT,
    "awaitingExternal" BOOLEAN NOT NULL DEFAULT false,
    "slotMissedAt" TIMESTAMP(3),
    "suggestedSlotAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "thumbnailText" TEXT NOT NULL,
    "tags" TEXT[],
    "sources" JSONB NOT NULL DEFAULT '[]',
    "autoCheck" JSONB NOT NULL DEFAULT '{}',
    "createdByType" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "changeNote" TEXT,
    "requiresRerender" BOOLEAN NOT NULL DEFAULT false,
    "mediaGeneration" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "versionId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "origin" TEXT NOT NULL,
    "rightsStatus" "RightsStatus" NOT NULL DEFAULT 'unknown',
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "license" TEXT,
    "editNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'scheduled',
    "mode" "PublicationMode" NOT NULL,
    "slotKey" TEXT,
    "activeJobKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "providerVideoId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "heldReason" TEXT,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus",
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ProviderKey" NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL,
    "displayName" TEXT,
    "externalAccountId" TEXT,
    "encryptedCredentials" TEXT,
    "scopes" TEXT[],
    "tokenExpiresAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastBeatAt" TIMESTAMP(3) NOT NULL,
    "info" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaCounter_organizationId_periodStart_format_key" ON "QuotaCounter"("organizationId", "periodStart", "format");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaEntry_idempotencyKey_key" ON "QuotaEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "QuotaEntry_organizationId_createdAt_idx" ON "QuotaEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotaEntry_jobId_idx" ON "QuotaEntry"("jobId");

-- CreateIndex
CREATE INDEX "ChannelSystem_organizationId_status_idx" ON "ChannelSystem"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceChannel_systemId_url_key" ON "ReferenceChannel"("systemId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlot_systemId_format_weekday_localTime_key" ON "ScheduleSlot"("systemId", "format", "weekday", "localTime");

-- CreateIndex
CREATE UNIQUE INDEX "WizardDraft_organizationId_userId_key" ON "WizardDraft"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_idempotencyKey_key" ON "ProductionJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_currentVersionId_key" ON "ProductionJob"("currentVersionId");

-- CreateIndex
CREATE INDEX "ProductionJob_status_nextRunAt_idx" ON "ProductionJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "ProductionJob_organizationId_status_idx" ON "ProductionJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ProductionJob_systemId_format_targetSlotAt_idx" ON "ProductionJob"("systemId", "format", "targetSlotAt");

-- CreateIndex
CREATE INDEX "ProductionJob_systemId_format_quotaCounterId_idx" ON "ProductionJob"("systemId", "format", "quotaCounterId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_jobId_number_key" ON "ContentVersion"("jobId", "number");

-- CreateIndex
CREATE INDEX "Asset_organizationId_kind_idx" ON "Asset"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "Asset_jobId_idx" ON "Asset"("jobId");

-- CreateIndex
CREATE INDEX "Approval_jobId_createdAt_idx" ON "Approval"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_slotKey_key" ON "Publication"("slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_activeJobKey_key" ON "Publication"("activeJobKey");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_idempotencyKey_key" ON "Publication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Publication_status_scheduledAt_idx" ON "Publication"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Publication_organizationId_scheduledAt_idx" ON "Publication"("organizationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_organizationId_provider_key" ON "ProviderConnection"("organizationId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaCounter" ADD CONSTRAINT "QuotaCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaEntry" ADD CONSTRAINT "QuotaEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaEntry" ADD CONSTRAINT "QuotaEntry_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "QuotaCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSystem" ADD CONSTRAINT "ChannelSystem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceChannel" ADD CONSTRAINT "ReferenceChannel_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ChannelSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceChannel" ADD CONSTRAINT "ReferenceChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ChannelSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardDraft" ADD CONSTRAINT "WizardDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ChannelSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "ChannelSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

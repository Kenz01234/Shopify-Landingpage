import type { Prisma, ReviewStage } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/errors";
import { orgNow } from "@/lib/clock";
import { transitionJob, type Ctx } from "@/lib/jobs/service";
import { assertSchedulable, createPublication } from "@/lib/publishing";
import { releaseQuota } from "@/lib/quota";
import { isEntitled, entitlementReason } from "@/lib/billing/subscription";
import { runAutoCheck } from "@/lib/autocheck";
import { ASSUMPTIONS } from "@/lib/plans";
import { formatInZone } from "@/lib/time";
import { audit } from "@/lib/audit";
import { isDemoMode, env } from "@/lib/env";
import type { ConfigSnapshot, SourceNote } from "@/providers/types";
import { z } from "zod";

const REVIEW_STATUS_BY_STAGE: Record<ReviewStage, "awaiting_topic_approval" | "awaiting_script_approval" | "awaiting_approval"> = {
  topic: "awaiting_topic_approval",
  script: "awaiting_script_approval",
  final: "awaiting_approval",
};

/** Zustände, in denen Inhalte bearbeitet werden dürfen. */
const EDITABLE = ["awaiting_topic_approval", "awaiting_script_approval", "awaiting_approval", "approved", "scheduled", "held"] as const;

async function loadJob(tx: Tx, ctx: Ctx, jobId: string) {
  const job = await tx.productionJob.findFirst({
    where: { id: jobId, organizationId: ctx.orgId },
    include: {
      currentVersion: true,
      system: { include: { organization: { include: { subscription: true, connections: true } } } },
    },
  });
  if (!job) throw notFound("Auftrag");
  return job;
}

function assertCurrentVersion(job: { currentVersionId: string | null }, versionId: string) {
  if (!job.currentVersionId || job.currentVersionId !== versionId) {
    throw conflict("Es gibt inzwischen eine neuere Inhaltsversion. Bitte die aktuelle Version prüfen.", { code: "STALE_VERSION" });
  }
}

/** Entzieht alle aktiven finalen Freigaben eines Auftrags und sagt geplante Veröffentlichungen ab. */
async function revokeFinalApprovals(tx: Tx, jobId: string, reason: string) {
  const revoked = await tx.approval.updateMany({
    where: { jobId, stage: "final", decision: "approved", revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  const cancelled = await tx.publication.updateMany({
    where: { jobId, status: { in: ["scheduled", "held"] } },
    data: { status: "cancelled", slotKey: null, activeJobKey: null, heldReason: null },
  });
  return { revoked: revoked.count, cancelled: cancelled.count };
}

export const approveSchema = z.object({
  versionId: z.string().min(1),
  stage: z.enum(["topic", "script", "final"]),
  scheduledAt: z.string().datetime().optional(),
  comment: z.string().max(1000).optional(),
});

/**
 * Freigabe. Für „final“ gilt: nur die aktuelle Version, nur mit Termin, nur mit aktivem Abo.
 * Es wird nie sofort veröffentlicht – der Worker veröffentlicht erst zum bestätigten Termin.
 */
export async function approve(ctx: Ctx, jobId: string, input: z.infer<typeof approveSchema>) {
  return prisma.$transaction(async (tx) => {
    const job = await loadJob(tx, ctx, jobId);
    const expected = REVIEW_STATUS_BY_STAGE[input.stage];
    if (job.status !== expected) throw conflict("Dieser Auftrag wartet gerade nicht auf diese Freigabe.");
    assertCurrentVersion(job, input.versionId);
    const version = job.currentVersion!;
    if (version.stage !== input.stage) throw conflict("Die Version passt nicht zur Freigabestufe.");

    const approval = await tx.approval.create({
      data: {
        organizationId: ctx.orgId,
        jobId: job.id,
        versionId: version.id,
        userId: ctx.userId,
        stage: input.stage,
        decision: "approved",
        comment: input.comment,
      },
    });
    const wd = (job.workingData ?? {}) as Record<string, unknown>;

    if (input.stage === "topic") {
      await transitionJob(tx, job, "scripting", `Thema bestätigt: „${version.title}“.`, {
        topic: version.title,
        nextRunAt: new Date(),
        workingData: { ...wd, topic: version.title, topicApproved: true } as Prisma.InputJsonValue,
      });
      await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "approval.topic", targetType: "job", targetId: job.id });
      return { stage: "topic" as const };
    }
    if (input.stage === "script") {
      await transitionJob(tx, job, "voiceover", "Skript bestätigt – Vertonung startet.", {
        nextRunAt: new Date(),
        workingData: { ...wd, script: version.script, title: version.title, scriptApproved: true } as Prisma.InputJsonValue,
      });
      await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "approval.script", targetType: "job", targetId: job.id });
      return { stage: "script" as const };
    }

    // final
    if (version.requiresRerender) throw new AppError("NEEDS_RERENDER", "Diese Version muss erst neu produziert werden.", 409);
    const org = job.system.organization;
    const now = orgNow(org);
    if (!isEntitled(org.subscription, now)) throw new AppError("NOT_ENTITLED", entitlementReason(org.subscription, now) ?? "Kein aktives Abo.", 402);
    if (job.system.status === "archived") throw new AppError("SYSTEM_ARCHIVED", "Das System ist archiviert.", 409);
    if (env().PUBLISH_PROVIDER === "youtube") {
      const yt = org.connections.find((c) => c.provider === "youtube");
      if (!yt || yt.status !== "connected") throw new AppError("NOT_CONNECTED", "Bitte zuerst einen YouTube-Kanal verbinden.", 409);
    }
    if (!input.scheduledAt) throw new AppError("SLOT_REQUIRED", "Bitte einen Veröffentlichungstermin wählen.", 422);
    const at = new Date(input.scheduledAt);
    await assertSchedulable(tx, { systemId: job.systemId, format: job.format, at, now, excludeJobId: job.id });

    await tx.approval.update({ where: { id: approval.id }, data: { scheduledFor: at } });
    const j2 = await transitionJob(tx, job, "approved", `Version ${version.number} freigegeben.`);
    const pub = await createPublication(tx, { job: { ...job, status: "approved" }, versionId: version.id, approvalId: approval.id, at });
    const tz = job.system.timezone;
    await transitionJob(tx, j2, "scheduled", `Eingeplant für ${formatInZone(at, tz)} (${tz}).${job.system.status === "paused" ? " System ist pausiert – wird bis zur Fortsetzung zurückgehalten." : ""}`, {
      targetSlotAt: at,
      slotMissedAt: null,
      suggestedSlotAt: null,
    });
    if (job.system.status === "paused") {
      await tx.publication.update({ where: { id: pub.id }, data: { status: "held", heldReason: "system_paused" } });
      await transitionJob(tx, { ...j2, status: "scheduled" }, "held", "Zurückgehalten, weil das System pausiert ist.");
    }
    await audit(tx, {
      orgId: ctx.orgId,
      actor: { type: "user", userId: ctx.userId },
      action: "approval.final",
      targetType: "job",
      targetId: job.id,
      meta: { versionId: version.id, versionNumber: version.number, scheduledAt: at.toISOString() },
    });
    return { stage: "final" as const, publicationId: pub.id, scheduledAt: at.toISOString(), label: formatInZone(at, tz), timezone: tz };
  });
}

export const changesSchema = z.object({
  versionId: z.string().min(1),
  note: z.string().trim().min(3, "Bitte kurz beschreiben, was geändert werden soll.").max(1000),
});

export async function requestChanges(ctx: Ctx, jobId: string, input: z.infer<typeof changesSchema>) {
  return prisma.$transaction(async (tx) => {
    const job = await loadJob(tx, ctx, jobId);
    if (!["awaiting_topic_approval", "awaiting_script_approval", "awaiting_approval"].includes(job.status)) {
      throw conflict("Für diesen Auftrag können gerade keine Änderungen angefordert werden.");
    }
    assertCurrentVersion(job, input.versionId);
    const version = job.currentVersion!;
    await tx.approval.create({
      data: { organizationId: ctx.orgId, jobId: job.id, versionId: version.id, userId: ctx.userId, stage: version.stage, decision: "changes_requested", comment: input.note },
    });
    const wd = (job.workingData ?? {}) as Record<string, unknown>;
    if (job.status === "awaiting_topic_approval") {
      await transitionJob(tx, job, "researching", `Anderes Thema gewünscht: „${input.note}“.`, {
        revisionNote: input.note,
        revisionCount: { increment: 1 },
        nextRunAt: new Date(),
        workingData: { ...wd, topicApproved: false } as Prisma.InputJsonValue,
      });
    } else if (job.status === "awaiting_script_approval") {
      await transitionJob(tx, job, "scripting", `Skript-Überarbeitung angefordert: „${input.note}“.`, {
        revisionNote: input.note,
        revisionCount: { increment: 1 },
        nextRunAt: new Date(),
      });
    } else {
      if (job.revisionCount >= ASSUMPTIONS.maxRevisionsPerJob) {
        throw new AppError(
          "MAX_REVISIONS",
          `Maximal ${ASSUMPTIONS.maxRevisionsPerJob} Überarbeitungen pro Auftrag (vorläufige Regel). Du kannst Texte selbst bearbeiten oder den Auftrag verwerfen.`,
          409,
        );
      }
      await transitionJob(tx, job, "changes_requested", `Überarbeitung angefordert: „${input.note}“.`, {
        revisionNote: input.note,
        revisionCount: { increment: 1 },
        nextRunAt: new Date(),
        workingData: { ...wd, resumeFrom: "scripting" } as Prisma.InputJsonValue,
      });
    }
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "approval.changes_requested", targetType: "job", targetId: job.id, meta: { note: input.note } });
    return { ok: true };
  });
}

export const rejectSchema = z.object({ versionId: z.string().min(1), reason: z.string().max(500).optional() });

export async function reject(ctx: Ctx, jobId: string, input: z.infer<typeof rejectSchema>) {
  return prisma.$transaction(async (tx) => {
    const job = await loadJob(tx, ctx, jobId);
    if (!["awaiting_topic_approval", "awaiting_script_approval", "awaiting_approval"].includes(job.status)) {
      throw conflict("Dieser Auftrag kann gerade nicht verworfen werden.");
    }
    assertCurrentVersion(job, input.versionId);
    await tx.approval.create({
      data: {
        organizationId: ctx.orgId,
        jobId: job.id,
        versionId: input.versionId,
        userId: ctx.userId,
        stage: job.currentVersion!.stage,
        decision: "rejected",
        comment: input.reason,
      },
    });
    await transitionJob(tx, job, "rejected", `Verworfen${input.reason ? `: „${input.reason}“` : ""}.`, { nextRunAt: null });
    const released = await releaseQuota(tx, job.id, "Vor Fertigstellung verworfen");
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "approval.rejected", targetType: "job", targetId: job.id });
    return { released };
  });
}

export const editSchema = z.object({
  baseVersionId: z.string().min(1),
  title: z.string().trim().min(1, "Titel fehlt").max(100, "Höchstens 100 Zeichen"),
  description: z.string().max(5000, "Höchstens 5.000 Zeichen"),
  script: z.string().min(1, "Skript fehlt").max(40000),
  thumbnailText: z.string().max(60, "Höchstens 60 Zeichen"),
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
  changeNote: z.string().max(300).optional(),
});

/**
 * Bearbeitung = neue Inhaltsversion. Eine bestehende finale Freigabe verliert dadurch ihre
 * Gültigkeit; geplante Veröffentlichungen werden abgesagt, bis erneut freigegeben wird.
 */
export async function saveEdit(ctx: Ctx, jobId: string, input: z.infer<typeof editSchema>) {
  return prisma.$transaction(async (tx) => {
    const job = await loadJob(tx, ctx, jobId);
    if (!(EDITABLE as readonly string[]).includes(job.status)) {
      throw conflict("In diesem Status kann der Inhalt nicht bearbeitet werden.");
    }
    assertCurrentVersion(job, input.baseVersionId);
    const base = job.currentVersion!;
    const tagsEqual = base.tags.join("\u0000") === input.tags.join("\u0000");
    const scriptChanged = base.script !== input.script;
    if (base.title === input.title && base.description === input.description && !scriptChanged && base.thumbnailText === input.thumbnailText && tagsEqual) {
      throw new AppError("NO_CHANGES", "Es gibt keine Änderungen zum Speichern.", 422);
    }
    const requiresRerender = base.stage === "final" && scriptChanged;
    if (requiresRerender && job.revisionCount >= ASSUMPTIONS.maxRevisionsPerJob) {
      throw new AppError("MAX_REVISIONS", `Skriptänderungen erfordern eine Neuproduktion – das Limit von ${ASSUMPTIONS.maxRevisionsPerJob} Überarbeitungen ist erreicht.`, 409);
    }
    const snapshot = job.configSnapshot as unknown as ConfigSnapshot;
    const assets = await tx.asset.findMany({ where: { jobId: job.id, generation: base.mediaGeneration } });
    const check = runAutoCheck({
      ...input,
      format: job.format,
      targetSeconds: job.format === "short" ? snapshot.shortSeconds : snapshot.longformMinutes * 60,
      sources: (base.sources as unknown as SourceNote[]) ?? [],
      media: assets.map((a) => ({ kind: a.kind, durationSec: a.durationSec })),
      isDemo: isDemoMode(),
      stage: base.stage,
    });
    const version = await tx.contentVersion.create({
      data: {
        organizationId: ctx.orgId,
        jobId: job.id,
        number: base.number + 1,
        stage: base.stage,
        title: input.title,
        description: input.description,
        script: input.script,
        thumbnailText: input.thumbnailText,
        tags: input.tags,
        sources: base.sources as Prisma.InputJsonValue,
        autoCheck: check as unknown as Prisma.InputJsonValue,
        createdByType: "user",
        createdByUserId: ctx.userId,
        changeNote: input.changeNote || (requiresRerender ? "Skript geändert – Neuproduktion erforderlich" : "Texte bearbeitet"),
        requiresRerender,
        mediaGeneration: base.mediaGeneration,
        durationSec: base.durationSec,
      },
    });
    await tx.productionJob.update({ where: { id: job.id }, data: { currentVersionId: version.id } });
    await tx.jobEvent.create({
      data: { organizationId: ctx.orgId, jobId: job.id, kind: "info", message: `Neue Version ${version.number} gespeichert (${version.changeNote}).` },
    });

    let approvalRevoked = false;
    if (base.stage === "final") {
      const r = await revokeFinalApprovals(tx, job.id, `Inhalt geändert (neue Version ${version.number})`);
      approvalRevoked = r.revoked > 0;
      let current = { id: job.id, status: job.status, organizationId: job.organizationId };
      if (["approved", "scheduled", "held"].includes(job.status)) {
        current = await transitionJob(tx, current, "awaiting_approval", "Freigabe aufgehoben: Der Inhalt wurde geändert. Bitte erneut prüfen und freigeben.");
      }
      if (requiresRerender) {
        const wd = (job.workingData ?? {}) as Record<string, unknown>;
        await transitionJob(tx, current, "changes_requested", "Skript geändert – Vertonung und Schnitt werden neu erstellt.", {
          revisionCount: { increment: 1 },
          revisionNote: "Skript manuell geändert",
          nextRunAt: new Date(),
          workingData: { ...wd, script: input.script, title: input.title, description: input.description, tags: input.tags, thumbnailText: input.thumbnailText, resumeFrom: "voiceover" } as Prisma.InputJsonValue,
        });
      }
    }
    await audit(tx, {
      orgId: ctx.orgId,
      actor: { type: "user", userId: ctx.userId },
      action: "content.edit",
      targetType: "job",
      targetId: job.id,
      meta: { versionNumber: version.number, approvalRevoked, requiresRerender },
    });
    return { versionId: version.id, number: version.number, approvalRevoked, requiresRerender };
  });
}

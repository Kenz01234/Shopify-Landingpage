import type { ChannelSystem, ContentFormat, JobStatus, Prisma, ProductionJob, ReferenceChannel } from "@/generated/prisma/client";
import { prisma, type Db, type Tx } from "@/lib/db";
import { AppError, conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { CANCELLABLE_STATUSES, PRE_APPROVAL_STATUSES, STATUS_META, canTransition } from "@/lib/jobs/state";
import { releaseQuota, reserveQuota, systemUsage, ensureCounter } from "@/lib/quota";
import { isEntitled, entitlementReason } from "@/lib/billing/subscription";
import { orgNow } from "@/lib/clock";
import { audit, type Actor } from "@/lib/audit";
import { nextFreeOccurrences } from "@/lib/time";
import { isDemoMode } from "@/lib/env";
import type { ConfigSnapshot } from "@/providers/types";

export type Ctx = { orgId: string; userId: string; actor?: Actor };

/**
 * Statuswechsel mit Prüfung des Zustandsautomaten und optimistischer Sperre:
 * Der Wechsel gelingt nur, wenn der Auftrag noch im erwarteten Ausgangszustand ist.
 */
export async function transitionJob(
  tx: Db,
  job: Pick<ProductionJob, "id" | "status" | "organizationId">,
  to: JobStatus,
  message: string,
  data: Prisma.ProductionJobUncheckedUpdateManyInput = {},
) {
  if (!canTransition(job.status, to)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `Wechsel von „${STATUS_META[job.status].label}“ zu „${STATUS_META[to].label}“ ist nicht möglich.`,
      409,
    );
  }
  const res = await tx.productionJob.updateMany({ where: { id: job.id, status: job.status }, data: { ...data, status: to } });
  if (res.count !== 1) throw conflict("Der Auftrag wurde zwischenzeitlich geändert. Bitte die Ansicht neu laden.");
  await tx.jobEvent.create({
    data: { organizationId: job.organizationId, jobId: job.id, fromStatus: job.status, toStatus: to, kind: "transition", message },
  });
  return { ...job, status: to };
}

export async function jobNote(db: Db, job: { id: string; organizationId: string }, message: string, kind = "info") {
  await db.jobEvent.create({ data: { organizationId: job.organizationId, jobId: job.id, kind, message } });
}

export function buildSnapshot(system: ChannelSystem & { referenceChannels: ReferenceChannel[] }): ConfigSnapshot {
  return {
    configVersion: system.configVersion,
    name: system.name,
    niche: system.niche,
    topics: system.topics,
    audience: system.audience,
    language: system.language,
    tone: system.tone,
    style: system.style,
    voiceKey: system.voiceKey,
    voiceLabel: system.voiceLabel,
    longformMinutes: system.longformMinutes,
    shortSeconds: system.shortSeconds,
    timezone: system.timezone,
    reviewMode: system.reviewMode,
    referenceChannels: system.referenceChannels.map((r) => r.url),
  };
}

/** Belegte Zeitpunkte eines Systems/Formats: aktive Veröffentlichungen + geplante, noch nicht freigegebene Aufträge. */
export async function occupiedSlots(db: Db, systemId: string, format: ContentFormat, excludeJobId?: string) {
  // Sequenziell, da `db` eine Transaktion (eine Verbindung) sein kann.
  const pubs = await db.publication.findMany({
    where: { systemId, format, status: { in: ["scheduled", "held", "publishing", "reconciling"] }, jobId: excludeJobId ? { not: excludeJobId } : undefined },
    select: { scheduledAt: true },
  });
  const jobs = await db.productionJob.findMany({
    where: {
      systemId,
      format,
      status: { in: PRE_APPROVAL_STATUSES },
      targetSlotAt: { not: null },
      slotMissedAt: null,
      id: excludeJobId ? { not: excludeJobId } : undefined,
    },
    select: { targetSlotAt: true },
  });
  const set = new Set<number>();
  pubs.forEach((p) => set.add(p.scheduledAt.getTime()));
  jobs.forEach((j) => j.targetSlotAt && set.add(j.targetSlotAt.getTime()));
  return set;
}

async function loadSystemForJob(db: Db, orgId: string, systemId: string) {
  const system = await db.channelSystem.findFirst({
    where: { id: systemId, organizationId: orgId },
    include: { referenceChannels: true, slots: true, organization: { include: { subscription: true } } },
  });
  if (!system) throw notFound("System");
  return system;
}

/**
 * Legt einen Auftrag manuell an. Idempotent über den vom Client erzeugten Schlüssel:
 * Doppelklicks oder Wiederholungen erzeugen keinen zweiten Auftrag und keine zweite Buchung.
 */
export async function createManualJob(
  ctx: Ctx,
  input: { systemId: string; format: ContentFormat; clientKey: string; demoScenario?: string },
) {
  const idempotencyKey = `manual:${ctx.orgId}:${input.clientKey}`;
  const existing = await prisma.productionJob.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.organizationId !== ctx.orgId) throw notFound("Auftrag");
    return { job: existing, created: false };
  }
  const system = await loadSystemForJob(prisma, ctx.orgId, input.systemId);
  if (system.status !== "active") throw new AppError("SYSTEM_INACTIVE", "Das System ist pausiert oder archiviert.", 409);
  if (input.format === "longform" && !system.longformEnabled) throw new AppError("FORMAT_DISABLED", "Longform ist in diesem System deaktiviert.");
  if (input.format === "short" && !system.shortsEnabled) throw new AppError("FORMAT_DISABLED", "Shorts sind in diesem System deaktiviert.");
  const sub = system.organization.subscription;
  const now = orgNow(system.organization);
  if (!sub || !isEntitled(sub, now)) throw new AppError("NOT_ENTITLED", entitlementReason(sub, now) ?? "Kein aktives Abo.", 402);

  const scenario = isDemoMode() && ["success", "transient_failure", "permanent_failure"].includes(input.demoScenario ?? "") ? input.demoScenario! : "success";

  try {
    const job = await prisma.$transaction(async (tx) => {
      const counter = await ensureCounter(tx, ctx.orgId, sub, input.format);
      const used = await systemUsage(tx, system.id, counter.id, input.format);
      const allocation = input.format === "longform" ? system.longformPerPeriod : system.shortsPerPeriod;
      if (used >= allocation) {
        throw new AppError(
          "SYSTEM_ALLOCATION_EXHAUSTED",
          `Die Zuteilung dieses Systems (${allocation} pro Zeitraum) ist ausgeschöpft. Du kannst sie im System erhöhen, solange der Plan es erlaubt.`,
          409,
        );
      }
      const occupied = await occupiedSlots(tx, system.id, input.format);
      const [slot] = nextFreeOccurrences(system.slots, system.timezone, input.format, now, occupied, 1);
      const job = await tx.productionJob.create({
        data: {
          organizationId: ctx.orgId,
          systemId: system.id,
          format: input.format,
          status: "queued",
          origin: "manual",
          demoScenario: scenario,
          configVersion: system.configVersion,
          configSnapshot: buildSnapshot(system) as unknown as Prisma.InputJsonValue,
          targetSlotAt: slot?.utc ?? null,
          idempotencyKey,
          nextRunAt: new Date(),
        },
      });
      await reserveQuota(tx, { orgId: ctx.orgId, jobId: job.id, format: input.format, sub });
      await tx.jobEvent.create({
        data: {
          organizationId: ctx.orgId,
          jobId: job.id,
          toStatus: "queued",
          kind: "transition",
          message:
            scenario === "success"
              ? "Auftrag manuell angelegt – Kontingent reserviert."
              : `Auftrag manuell angelegt (Demo-Szenario: ${scenario === "transient_failure" ? "technischer Fehler mit Wiederholung" : "dauerhafter Providerfehler"}).`,
        },
      });
      await audit(tx, { orgId: ctx.orgId, actor: ctx.actor ?? { type: "user", userId: ctx.userId }, action: "job.create", targetType: "job", targetId: job.id, meta: { format: input.format, scenario } });
      return job;
    });
    return { job, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await prisma.productionJob.findUnique({ where: { idempotencyKey } });
      if (again && again.organizationId === ctx.orgId) return { job: again, created: false };
    }
    throw e;
  }
}

/** Planmäßiger Auftrag für einen Slot (vom Scheduler). Gibt null zurück, wenn schon vorhanden oder kein Kontingent. */
export async function createScheduledJob(
  tx: Tx,
  system: ChannelSystem & { referenceChannels: ReferenceChannel[] },
  sub: NonNullable<Parameters<typeof reserveQuota>[1]["sub"]>,
  format: ContentFormat,
  slotAt: Date,
) {
  const idempotencyKey = `slot:${system.id}:${format}:${slotAt.toISOString()}`;
  const exists = await tx.productionJob.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (exists) return null;
  const counter = await ensureCounter(tx, system.organizationId, sub, format);
  const used = await systemUsage(tx, system.id, counter.id, format);
  const allocation = format === "longform" ? system.longformPerPeriod : system.shortsPerPeriod;
  if (used >= allocation) return { skipped: "allocation" as const };
  const job = await tx.productionJob.create({
    data: {
      organizationId: system.organizationId,
      systemId: system.id,
      format,
      status: "queued",
      origin: "schedule",
      configVersion: system.configVersion,
      configSnapshot: buildSnapshot(system) as unknown as Prisma.InputJsonValue,
      targetSlotAt: slotAt,
      idempotencyKey,
      nextRunAt: new Date(),
    },
  });
  await reserveQuota(tx, { orgId: system.organizationId, jobId: job.id, format, sub });
  await tx.jobEvent.create({
    data: { organizationId: system.organizationId, jobId: job.id, toStatus: "queued", kind: "transition", message: "Automatisch für den nächsten Slot angelegt – Kontingent reserviert." },
  });
  return { job };
}

export async function getJobForOrg(db: Db, orgId: string, jobId: string) {
  const job = await db.productionJob.findFirst({ where: { id: jobId, organizationId: orgId } });
  if (!job) throw notFound("Auftrag");
  return job;
}

/** Abbruch: gibt Reservierungen frei, sagt aktive Veröffentlichungen ab. */
export async function cancelJob(ctx: Ctx, jobId: string, reason = "Vom Nutzer abgebrochen") {
  return prisma.$transaction(async (tx) => {
    const job = await getJobForOrg(tx, ctx.orgId, jobId);
    if (!CANCELLABLE_STATUSES.includes(job.status)) {
      throw new AppError("NOT_CANCELLABLE", `Im Status „${STATUS_META[job.status].label}“ kann der Auftrag nicht abgebrochen werden.`, 409);
    }
    await transitionJob(tx, job, "cancelled", `Abgebrochen: ${reason}`, { cancelReason: reason, lockedBy: null, lockedUntil: null, nextRunAt: null, awaitingExternal: false });
    await releaseQuota(tx, job.id, "Abbruch vor Fertigstellung");
    await tx.publication.updateMany({
      where: { jobId: job.id, status: { in: ["scheduled", "held"] } },
      data: { status: "cancelled", slotKey: null, activeJobKey: null },
    });
    await audit(tx, { orgId: ctx.orgId, actor: ctx.actor ?? { type: "user", userId: ctx.userId }, action: "job.cancel", targetType: "job", targetId: job.id, meta: { reason } });
    return job.id;
  });
}

/**
 * Manuelle Wiederholung eines fehlgeschlagenen Auftrags. Setzt beim fehlgeschlagenen Schritt fort.
 * Bucht kein Kontingent erneut (Reservierung ist an den Auftrag gebunden).
 */
export async function retryJob(ctx: Ctx, jobId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await getJobForOrg(tx, ctx.orgId, jobId);
    if (job.status !== "failed") throw new AppError("NOT_FAILED", "Nur fehlgeschlagene Aufträge können wiederholt werden.", 409);
    const system = await tx.channelSystem.findFirst({ where: { id: job.systemId, organizationId: ctx.orgId } });
    if (!system || system.status === "archived") throw new AppError("SYSTEM_INACTIVE", "Das System ist archiviert.", 409);
    const wd = (job.workingData ?? {}) as Record<string, unknown>;
    const resumeFrom = job.failedStep && job.failedStep !== "queued" ? job.failedStep : undefined;
    await transitionJob(tx, job, "queued", resumeFrom ? `Erneuter Versuch ab Schritt „${STATUS_META[resumeFrom].label}“.` : "Erneuter Versuch.", {
      attempt: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      retryStep: null,
      nextRunAt: new Date(),
      lockedBy: null,
      lockedUntil: null,
      awaitingExternal: false,
      externalRunId: null,
      demoScenario: "success",
      workingData: { ...wd, resumeFrom } as Prisma.InputJsonValue,
    });
    await audit(tx, { orgId: ctx.orgId, actor: ctx.actor ?? { type: "user", userId: ctx.userId }, action: "job.retry", targetType: "job", targetId: job.id });
    return job.id;
  });
}

import type { ContentFormat, Prisma, ProductionJob } from "@/generated/prisma/client";
import { prisma, type Db, type Tx } from "@/lib/db";
import { AppError, conflict, isUniqueViolation, notFound } from "@/lib/errors";
import { orgNow } from "@/lib/clock";
import { nextFreeOccurrences, formatInZone, adjustmentText, type SlotAdjustment } from "@/lib/time";
import { occupiedSlots, transitionJob, type Ctx } from "@/lib/jobs/service";
import { isEntitled, entitlementReason } from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

/** Mindestvorlauf für einen Termin – verhindert „sofort“-Veröffentlichungen aus Versehen. */
export const MIN_LEAD_MS = 2 * 60_000;

export const slotKeyFor = (systemId: string, format: ContentFormat, at: Date) => `${systemId}:${format}:${at.toISOString()}`;

export function publicationMode(): "simulated" | "live" {
  return env().PUBLISH_PROVIDER === "youtube" ? "live" : "simulated";
}

export async function freeSlotsForJob(ctx: Ctx, jobId: string, count = 6) {
  const job = await prisma.productionJob.findFirst({
    where: { id: jobId, organizationId: ctx.orgId },
    include: { system: { include: { slots: true, organization: true } } },
  });
  if (!job) throw notFound("Auftrag");
  const now = orgNow(job.system.organization);
  const occupied = await occupiedSlots(prisma, job.systemId, job.format, job.id);
  const after = new Date(now.getTime() + MIN_LEAD_MS);
  const slots = nextFreeOccurrences(job.system.slots, job.system.timezone, job.format, after, occupied, count);
  return {
    timezone: job.system.timezone,
    now,
    slots: slots.map((s) => ({
      at: s.utc.toISOString(),
      label: formatInZone(s.utc, job.system.timezone),
      adjustment: s.adjustment,
      adjustmentText: s.adjustment ? adjustmentText[s.adjustment] : null,
      isTarget: job.targetSlotAt?.getTime() === s.utc.getTime(),
    })),
    targetSlotAt: job.targetSlotAt,
    suggestedSlotAt: job.suggestedSlotAt,
    slotMissedAt: job.slotMissedAt,
  };
}

/** Prüft einen gewünschten Termin serverseitig: Zukunft, keine Kollision. */
export async function assertSchedulable(
  db: Db,
  p: { systemId: string; format: ContentFormat; at: Date; now: Date; excludeJobId?: string },
) {
  if (Number.isNaN(p.at.getTime())) throw new AppError("INVALID_DATE", "Ungültiger Termin.");
  if (p.at.getTime() < p.now.getTime() + MIN_LEAD_MS) {
    throw new AppError("PAST_SLOT", "Der Termin liegt in der Vergangenheit oder zu knapp in der Zukunft (mind. 2 Minuten Vorlauf).", 422);
  }
  if (p.at.getTime() > p.now.getTime() + 180 * 86400000) {
    throw new AppError("TOO_FAR", "Termine können höchstens 180 Tage im Voraus geplant werden.", 422);
  }
  const clash = await db.publication.findFirst({
    where: {
      systemId: p.systemId,
      format: p.format,
      scheduledAt: p.at,
      status: { in: ["scheduled", "held", "publishing", "reconciling"] },
      jobId: p.excludeJobId ? { not: p.excludeJobId } : undefined,
    },
    select: { id: true },
  });
  if (clash) throw conflict("Zu diesem Zeitpunkt ist in diesem System bereits eine Veröffentlichung dieses Formats geplant.");
}

/** Legt die Veröffentlichung an (innerhalb der Freigabe-Transaktion). */
export async function createPublication(
  tx: Tx,
  p: { job: ProductionJob; versionId: string; approvalId: string; at: Date },
) {
  try {
    return await tx.publication.create({
      data: {
        organizationId: p.job.organizationId,
        jobId: p.job.id,
        systemId: p.job.systemId,
        versionId: p.versionId,
        approvalId: p.approvalId,
        format: p.job.format,
        scheduledAt: p.at,
        status: "scheduled",
        mode: publicationMode(),
        slotKey: slotKeyFor(p.job.systemId, p.job.format, p.at),
        activeJobKey: p.job.id,
        idempotencyKey: `pub:${p.job.id}:${p.approvalId}`,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Der Termin ist inzwischen belegt oder der Auftrag ist bereits eingeplant.");
    throw e;
  }
}

/** Termin einer geplanten/zurückgehaltenen Veröffentlichung ändern. */
export async function reschedulePublication(ctx: Ctx, publicationId: string, at: Date, adjustment: SlotAdjustment = null) {
  return prisma.$transaction(async (tx) => {
    const pub = await tx.publication.findFirst({
      where: { id: publicationId, organizationId: ctx.orgId },
      include: { job: true, system: { include: { organization: { include: { subscription: true } } } }, approval: true },
    });
    if (!pub) throw notFound("Veröffentlichung");
    if (!["scheduled", "held"].includes(pub.status)) throw new AppError("NOT_RESCHEDULABLE", "Dieser Termin kann nicht mehr geändert werden.", 409);
    const now = orgNow(pub.system.organization);
    await assertSchedulable(tx, { systemId: pub.systemId, format: pub.format, at, now, excludeJobId: pub.jobId });

    const approvalValid = pub.approval.decision === "approved" && !pub.approval.revokedAt && pub.job.currentVersionId === pub.versionId;
    if (!approvalValid) throw new AppError("APPROVAL_INVALID", "Die Freigabe ist nicht mehr gültig. Bitte den Inhalt erneut freigeben.", 409);

    let nextStatus: "scheduled" | "held" = "scheduled";
    let heldReason: string | null = null;
    if (pub.system.status !== "active") {
      nextStatus = "held";
      heldReason = "system_paused";
    } else if (!isEntitled(pub.system.organization.subscription, now)) {
      nextStatus = "held";
      heldReason = "subscription_inactive";
    }
    try {
      await tx.publication.update({
        where: { id: pub.id },
        data: { scheduledAt: at, slotKey: slotKeyFor(pub.systemId, pub.format, at), status: nextStatus, heldReason },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("Zu diesem Zeitpunkt ist bereits eine Veröffentlichung geplant.");
      throw e;
    }
    const tz = pub.system.timezone;
    const msg = `Termin geändert auf ${formatInZone(at, tz)}${adjustment ? ` (${adjustmentText[adjustment]})` : ""}.`;
    if (pub.job.status === "held" && nextStatus === "scheduled") {
      await transitionJob(tx, pub.job, "scheduled", msg, { targetSlotAt: at, slotMissedAt: null, suggestedSlotAt: null });
    } else {
      await tx.productionJob.update({ where: { id: pub.jobId }, data: { targetSlotAt: at, slotMissedAt: null, suggestedSlotAt: null } });
      await tx.jobEvent.create({ data: { organizationId: ctx.orgId, jobId: pub.jobId, kind: "info", message: msg } });
    }
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "publication.reschedule", targetType: "publication", targetId: pub.id, meta: { at: at.toISOString() } });
    return { status: nextStatus, heldReason, reason: heldReason ? entitlementReason(pub.system.organization.subscription, now) : null };
  });
}

export const HELD_REASON_DE: Record<string, string> = {
  system_paused: "System ist pausiert – Veröffentlichung wird zurückgehalten.",
  subscription_inactive: "Abo nicht aktiv – Veröffentlichung wird zurückgehalten.",
  slot_passed: "Der Termin ist verstrichen – bitte neuen Termin bestätigen.",
  not_connected: "Kein YouTube-Kanal verbunden.",
};

export type CalendarItem = {
  id: string;
  kind: "publication" | "pending";
  jobId: string;
  publicationId?: string;
  systemId: string;
  systemName: string;
  format: ContentFormat;
  at: string;
  status: string;
  mode?: string;
  title: string;
  timezone: string;
  heldReason?: string | null;
  slotMissed?: boolean;
};

export async function calendarItems(orgId: string, from: Date, to: Date): Promise<CalendarItem[]> {
  const [pubs, pending] = await Promise.all([
    prisma.publication.findMany({
      where: { organizationId: orgId, scheduledAt: { gte: from, lt: to }, status: { not: "cancelled" } },
      include: { system: { select: { name: true, timezone: true } }, version: { select: { title: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.productionJob.findMany({
      where: {
        organizationId: orgId,
        targetSlotAt: { gte: from, lt: to },
        status: { notIn: ["approved", "scheduled", "held", "publishing", "reconciling", "published", "cancelled", "rejected"] },
      },
      include: { system: { select: { name: true, timezone: true } }, currentVersion: { select: { title: true } } },
      orderBy: { targetSlotAt: "asc" },
    }),
  ]);
  const items: CalendarItem[] = pubs.map((p) => ({
    id: `p-${p.id}`,
    kind: "publication",
    jobId: p.jobId,
    publicationId: p.id,
    systemId: p.systemId,
    systemName: p.system.name,
    format: p.format,
    at: p.scheduledAt.toISOString(),
    status: p.status,
    mode: p.mode,
    title: p.version.title,
    timezone: p.system.timezone,
    heldReason: p.heldReason,
  }));
  for (const j of pending) {
    items.push({
      id: `j-${j.id}`,
      kind: "pending",
      jobId: j.id,
      systemId: j.systemId,
      systemName: j.system.name,
      format: j.format,
      at: j.targetSlotAt!.toISOString(),
      status: j.status,
      title: j.currentVersion?.title ?? j.topic ?? "Thema wird recherchiert",
      timezone: j.system.timezone,
      slotMissed: !!j.slotMissedAt,
    });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export type { Prisma };

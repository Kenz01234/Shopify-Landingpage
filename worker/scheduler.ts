import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { orgNow } from "@/lib/clock";
import { isEntitled } from "@/lib/billing/subscription";
import { rollSubscription } from "@/lib/billing/service";
import { occurrencesBetween, nextFreeOccurrences, formatInZone } from "@/lib/time";
import { createScheduledJob, occupiedSlots, transitionJob } from "@/lib/jobs/service";
import { PRE_APPROVAL_STATUSES } from "@/lib/jobs/state";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * Scheduler-Durchlauf (idempotent, mehrfach parallel ausführbar):
 * 1. Demo-Abos zum Periodenende verlängern/beenden
 * 2. Für aktive Systeme Aufträge für kommende Slots anlegen (Idempotenzschlüssel je System/Format/Slot)
 * 3. Verstrichene Slots ohne Freigabe markieren und neuen Slot vorschlagen – niemals veröffentlichen
 * 4. Zeitüberschreitungen externer Aufträge erkennen
 */
export async function schedulerTick() {
  const orgs = await prisma.organization.findMany({ include: { subscription: true } });
  const stats = { orgs: orgs.length, created: 0, missed: 0, renewed: 0, timeouts: 0 };
  for (const org of orgs) {
    const now = orgNow(org);
    let sub = org.subscription;
    if (sub) {
      const before = sub.updatedAt.getTime();
      sub = await rollSubscription(prisma, sub, now);
      if (sub.updatedAt.getTime() !== before) stats.renewed++;
    }
    if (sub && isEntitled(sub, now)) stats.created += await planCycles(org.id, sub, now);
    stats.missed += await markMissedSlots(org.id, now);
  }
  stats.timeouts += await externalTimeouts();
  return stats;
}

async function planCycles(orgId: string, sub: NonNullable<Awaited<ReturnType<typeof prisma.subscription.findUnique>>>, now: Date) {
  const horizon = new Date(now.getTime() + env().PLANNING_HORIZON_DAYS * 86400000);
  const systems = await prisma.channelSystem.findMany({
    where: { organizationId: orgId, status: "active" },
    include: { slots: true, referenceChannels: true },
  });
  let created = 0;
  for (const system of systems) {
    const occ = occurrencesBetween(system.slots, system.timezone, now, horizon).filter((o) =>
      o.format === "longform" ? system.longformEnabled : system.shortsEnabled,
    );
    const exhausted = new Set<string>();
    for (const o of occ) {
      if (exhausted.has(o.format)) continue;
      try {
        const res = await prisma.$transaction((tx) => createScheduledJob(tx, system, sub, o.format, o.utc));
        if (res && "job" in res) created++;
        if (res && "skipped" in res) exhausted.add(o.format);
      } catch (e) {
        if (isUniqueViolation(e)) continue; // parallel angelegt
        if (e instanceof AppError && e.code === "QUOTA_EXHAUSTED") {
          exhausted.add(o.format);
          await noteOnce(orgId, `quota_exhausted:${o.format}:${sub.currentPeriodStart.toISOString()}`, e.message);
          continue;
        }
        throw e;
      }
    }
  }
  return created;
}

async function noteOnce(orgId: string, key: string, message: string) {
  const exists = await prisma.auditEvent.findFirst({ where: { organizationId: orgId, action: "notice", targetId: key } });
  if (!exists) await audit(prisma, { orgId, actor: { type: "worker" }, action: "notice", targetType: "notice", targetId: key, meta: { message } });
}

/** Termin verstrichen, aber keine Freigabe → nicht veröffentlichen, sondern Vorschlag machen. */
async function markMissedSlots(orgId: string, now: Date) {
  const jobs = await prisma.productionJob.findMany({
    where: { organizationId: orgId, status: { in: PRE_APPROVAL_STATUSES }, targetSlotAt: { lte: now }, slotMissedAt: null },
    include: { system: { include: { slots: true } } },
  });
  for (const j of jobs) {
    const occ = await occupiedSlots(prisma, j.systemId, j.format, j.id);
    const [s] = nextFreeOccurrences(j.system.slots, j.system.timezone, j.format, new Date(now.getTime() + 5 * 60_000), occ, 1);
    const res = await prisma.productionJob.updateMany({
      where: { id: j.id, slotMissedAt: null, status: j.status },
      data: { slotMissedAt: now, suggestedSlotAt: s?.utc ?? null },
    });
    if (res.count) {
      await prisma.jobEvent.create({
        data: {
          organizationId: orgId,
          jobId: j.id,
          kind: "warning",
          message: `Der geplante Termin ist ohne Freigabe verstrichen – es wurde nichts veröffentlicht.${s ? ` Vorschlag: ${formatInZone(s.utc, j.system.timezone)}.` : ""}`,
        },
      });
    }
  }
  // Geplante, aber zurückgehaltene Veröffentlichungen, deren Termin verstrichen ist
  const held = await prisma.publication.findMany({
    where: { organizationId: orgId, status: "held", scheduledAt: { lte: now }, heldReason: { not: "slot_passed" } },
  });
  for (const p of held) {
    await prisma.publication.update({ where: { id: p.id }, data: { heldReason: p.heldReason === "system_paused" ? "system_paused" : "slot_passed" } });
  }
  return jobs.length;
}

async function externalTimeouts() {
  const limit = new Date(Date.now() - env().N8N_EXTERNAL_TIMEOUT_MIN * 60_000);
  const jobs = await prisma.productionJob.findMany({ where: { awaitingExternal: true, externalAcceptedAt: { lt: limit } } });
  for (const j of jobs) {
    try {
      await transitionJob(prisma, j, "failed", `Keine Rückmeldung vom Produktionsdienst innerhalb von ${env().N8N_EXTERNAL_TIMEOUT_MIN} Minuten.`, {
        awaitingExternal: false,
        failedStep: j.status,
        lastErrorCode: "EXTERNAL_TIMEOUT",
        lastErrorMessage: "Zeitüberschreitung beim externen Produktionsdienst",
        workingData: { ...((j.workingData ?? {}) as object) } as Prisma.InputJsonValue,
      });
    } catch {
      /* Status hat sich parallel geändert */
    }
  }
  return jobs.length;
}

import type { ContentFormat, Subscription } from "@/generated/prisma/client";
import { prisma, type Db, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { planLimits } from "@/lib/billing/subscription";

/**
 * Kontingente je Abo-Periode und Format.
 * Regeln (Demo, dokumentiert in docs/ANNAHMEN.md):
 * - Reservierung beim Anlegen eines Auftrags, Verbrauch bei Fertigstellung der ersten finalen Version.
 * - Abbruch/Verwerfen vor Fertigstellung gibt die Reservierung frei.
 * - Technische Wiederholungen und eigene Revisionen buchen nicht erneut (Idempotenzschlüssel je Auftrag).
 * - Eine Reservierung bleibt in der Periode, in der sie entstanden ist.
 */

export async function ensureCounter(db: Db, orgId: string, sub: Subscription, format: ContentFormat) {
  const limits = planLimits(sub.plan);
  const limit = format === "longform" ? limits.longform : limits.short;
  return db.quotaCounter.upsert({
    where: { organizationId_periodStart_format: { organizationId: orgId, periodStart: sub.currentPeriodStart, format } },
    create: { organizationId: orgId, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd, format, limit },
    update: {},
  });
}

/** Aktualisiert Limits der laufenden Periode (z. B. nach Upgrade). Verbrauch bleibt erhalten. */
export async function syncCounterLimits(db: Db, orgId: string, sub: Subscription) {
  const limits = planLimits(sub.plan);
  for (const format of ["longform", "short"] as const) {
    const c = await ensureCounter(db, orgId, sub, format);
    const limit = format === "longform" ? limits.longform : limits.short;
    if (c.limit !== limit) await db.quotaCounter.update({ where: { id: c.id }, data: { limit, periodEnd: sub.currentPeriodEnd } });
  }
}

/**
 * Reserviert eine Einheit – atomar über ein bedingtes UPDATE. Muss innerhalb einer Transaktion
 * aufgerufen werden, damit Journal und Zähler gemeinsam festgeschrieben oder verworfen werden.
 */
export async function reserveQuota(tx: Tx, p: { orgId: string; jobId: string; format: ContentFormat; sub: Subscription }) {
  const key = `reserve:${p.jobId}`;
  const existing = await tx.quotaEntry.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { counterId: existing.counterId, already: true };

  const counter = await ensureCounter(tx, p.orgId, p.sub, p.format);
  const updated = await tx.$executeRaw`
    UPDATE "QuotaCounter"
       SET "reserved" = "reserved" + 1, "updatedAt" = now()
     WHERE "id" = ${counter.id} AND "reserved" + "consumed" + 1 <= "limit"`;
  if (updated !== 1) {
    throw new AppError(
      "QUOTA_EXHAUSTED",
      p.format === "longform"
        ? "Das Longform-Kontingent dieses Abrechnungszeitraums ist ausgeschöpft."
        : "Das Shorts-Kontingent dieses Abrechnungszeitraums ist ausgeschöpft.",
      409,
    );
  }
  await tx.quotaEntry.create({
    data: { organizationId: p.orgId, counterId: counter.id, jobId: p.jobId, format: p.format, action: "reserve", idempotencyKey: key },
  });
  await tx.productionJob.updateMany({ where: { id: p.jobId }, data: { quotaState: "reserved", quotaCounterId: counter.id } });
  return { counterId: counter.id, already: false };
}

export async function consumeQuota(tx: Tx, jobId: string) {
  const key = `consume:${jobId}`;
  if (await tx.quotaEntry.findUnique({ where: { idempotencyKey: key } })) return false;
  const reserve = await tx.quotaEntry.findUnique({ where: { idempotencyKey: `reserve:${jobId}` } });
  if (!reserve) return false;
  if (await tx.quotaEntry.findUnique({ where: { idempotencyKey: `release:${jobId}` } })) return false;
  const updated = await tx.$executeRaw`
    UPDATE "QuotaCounter"
       SET "reserved" = "reserved" - 1, "consumed" = "consumed" + 1, "updatedAt" = now()
     WHERE "id" = ${reserve.counterId} AND "reserved" >= 1`;
  if (updated !== 1) throw new AppError("QUOTA_INCONSISTENT", "Kontingentbuchung inkonsistent.", 500);
  await tx.quotaEntry.create({
    data: {
      organizationId: reserve.organizationId,
      counterId: reserve.counterId,
      jobId,
      format: reserve.format,
      action: "consume",
      idempotencyKey: key,
    },
  });
  await tx.productionJob.updateMany({ where: { id: jobId }, data: { quotaState: "consumed" } });
  return true;
}

export async function releaseQuota(tx: Tx, jobId: string, note?: string) {
  const key = `release:${jobId}`;
  if (await tx.quotaEntry.findUnique({ where: { idempotencyKey: key } })) return false;
  if (await tx.quotaEntry.findUnique({ where: { idempotencyKey: `consume:${jobId}` } })) return false;
  const reserve = await tx.quotaEntry.findUnique({ where: { idempotencyKey: `reserve:${jobId}` } });
  if (!reserve) return false;
  const updated = await tx.$executeRaw`
    UPDATE "QuotaCounter" SET "reserved" = "reserved" - 1, "updatedAt" = now()
     WHERE "id" = ${reserve.counterId} AND "reserved" >= 1`;
  if (updated !== 1) throw new AppError("QUOTA_INCONSISTENT", "Kontingentbuchung inkonsistent.", 500);
  await tx.quotaEntry.create({
    data: {
      organizationId: reserve.organizationId,
      counterId: reserve.counterId,
      jobId,
      format: reserve.format,
      action: "release",
      idempotencyKey: key,
      note,
    },
  });
  await tx.productionJob.updateMany({ where: { id: jobId }, data: { quotaState: "released" } });
  return true;
}

/** Anzahl der in dieser Periode belegten Aufträge eines Systems (für die Systemzuteilung). */
export async function systemUsage(db: Db, systemId: string, counterId: string, format: ContentFormat) {
  return db.productionJob.count({
    where: { systemId, format, quotaCounterId: counterId, quotaState: { in: ["reserved", "consumed"] } },
  });
}

export async function quotaSummary(orgId: string, sub: Subscription | null) {
  if (!sub) return null;
  const counters = await prisma.$transaction(async (tx) => {
    const l = await ensureCounter(tx, orgId, sub, "longform");
    const s = await ensureCounter(tx, orgId, sub, "short");
    return { l, s };
  });
  const view = (c: typeof counters.l) => ({
    limit: c.limit,
    reserved: c.reserved,
    consumed: c.consumed,
    free: Math.max(0, c.limit - c.reserved - c.consumed),
  });
  return {
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    longform: view(counters.l),
    short: view(counters.s),
  };
}

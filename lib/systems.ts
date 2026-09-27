import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { systemInputSchema, validateAgainstPlan, type SystemInput } from "@/lib/validation/system";
import { parseYouTubeChannel } from "@/lib/youtube-url";
import { findDemoVoice } from "@/lib/voices";
import { ASSUMPTIONS } from "@/lib/plans";
import { orgNow } from "@/lib/clock";
import { occurrencesBetween, formatInZone, adjustmentText } from "@/lib/time";
import { transitionJob, type Ctx } from "@/lib/jobs/service";
import { releaseQuota } from "@/lib/quota";
import { audit } from "@/lib/audit";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

/** Feste Reihenfolge, keine Duplikate; ohne Shorts bleibt YouTube als neutraler Standard gespeichert. */
function normalizePlatforms(input: SystemInput): PlatformKey[] {
  const list = PLATFORM_KEYS.filter((p) => input.shortPlatforms?.includes(p));
  return input.shortsEnabled && list.length ? list : ["youtube"];
}

export async function allocationUsedByOthers(db: Tx | typeof prisma, orgId: string, excludeSystemId?: string) {
  const systems = await db.channelSystem.findMany({
    where: { organizationId: orgId, status: { not: "archived" }, id: excludeSystemId ? { not: excludeSystemId } : undefined },
    select: { longformPerPeriod: true, shortsPerPeriod: true },
  });
  return systems.reduce((a, s) => ({ longform: a.longform + s.longformPerPeriod, shorts: a.shorts + s.shortsPerPeriod }), { longform: 0, shorts: 0 });
}

async function validateFull(tx: Tx, orgId: string, raw: unknown, excludeSystemId?: string) {
  const parsed = systemInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".")] = i.message;
    throw new AppError("VALIDATION", "Bitte die markierten Angaben prüfen.", 422, { fields });
  }
  const input = parsed.data;
  const sub = await tx.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub || sub.status === "canceled") throw new AppError("NO_PLAN", "Für ein System wird ein aktiver Plan benötigt.", 402);
  const plan = sub.plan;
  const used = await allocationUsedByOthers(tx, orgId, excludeSystemId);
  const errors = validateAgainstPlan(input, plan, used);
  if (Object.keys(errors).length) throw new AppError("VALIDATION", "Bitte die markierten Angaben prüfen.", 422, { fields: errors });
  return input;
}

function refRows(orgId: string, systemId: string, input: SystemInput) {
  return input.referenceChannels.map((raw) => {
    const r = parseYouTubeChannel(raw);
    if (!r.ok) throw new AppError("VALIDATION", r.error, 422);
    return { organizationId: orgId, systemId, input: raw.trim(), url: r.value.url, kind: r.value.kind, identifier: r.value.identifier };
  });
}

function slotRows(orgId: string, systemId: string, input: SystemInput) {
  return input.slots.map((s) => ({ organizationId: orgId, systemId, format: s.format, weekday: s.weekday, localTime: s.localTime }));
}

export async function createSystem(ctx: Ctx, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.channelSystem.count({ where: { organizationId: ctx.orgId, status: { not: "archived" } } });
    if (count >= ASSUMPTIONS.maxSystemsPerOrg) {
      throw new AppError("MAX_SYSTEMS", `Vorläufig höchstens ${ASSUMPTIONS.maxSystemsPerOrg} aktive Systeme pro Konto.`, 409);
    }
    const input = await validateFull(tx, ctx.orgId, raw);
    const voice = findDemoVoice(input.voiceKey);
    const system = await tx.channelSystem.create({
      data: {
        organizationId: ctx.orgId,
        name: input.name,
        niche: input.niche,
        topics: input.topics,
        audience: input.audience,
        language: input.language,
        tone: input.tone,
        style: input.style,
        voiceKey: input.voiceKey,
        voiceLabel: voice?.label ?? input.voiceKey,
        longformEnabled: input.longformEnabled,
        shortsEnabled: input.shortsEnabled,
        shortPlatforms: normalizePlatforms(input),
        longformPerPeriod: input.longformEnabled ? input.longformPerPeriod : 0,
        longformMinutes: input.longformMinutes,
        shortsPerPeriod: input.shortsEnabled ? input.shortsPerPeriod : 0,
        shortSeconds: input.shortSeconds,
        timezone: input.timezone,
        reviewMode: input.reviewMode,
        status: "active",
        activatedAt: new Date(),
      },
    });
    await tx.referenceChannel.createMany({ data: refRows(ctx.orgId, system.id, input) });
    await tx.scheduleSlot.createMany({ data: slotRows(ctx.orgId, system.id, input) });
    await tx.wizardDraft.deleteMany({ where: { organizationId: ctx.orgId, userId: ctx.userId } });
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "system.create", targetType: "system", targetId: system.id });
    return system;
  });
}

export async function updateSystem(ctx: Ctx, systemId: string, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.channelSystem.findFirst({ where: { id: systemId, organizationId: ctx.orgId } });
    if (!existing) throw notFound("System");
    if (existing.status === "archived") throw new AppError("ARCHIVED", "Archivierte Systeme können nicht bearbeitet werden.", 409);
    const input = await validateFull(tx, ctx.orgId, raw, systemId);
    const voice = findDemoVoice(input.voiceKey);
    const system = await tx.channelSystem.update({
      where: { id: systemId },
      data: {
        name: input.name,
        niche: input.niche,
        topics: input.topics,
        audience: input.audience,
        language: input.language,
        tone: input.tone,
        style: input.style,
        voiceKey: input.voiceKey,
        voiceLabel: voice?.label ?? input.voiceKey,
        longformEnabled: input.longformEnabled,
        shortsEnabled: input.shortsEnabled,
        shortPlatforms: normalizePlatforms(input),
        longformPerPeriod: input.longformEnabled ? input.longformPerPeriod : 0,
        longformMinutes: input.longformMinutes,
        shortsPerPeriod: input.shortsEnabled ? input.shortsPerPeriod : 0,
        shortSeconds: input.shortSeconds,
        timezone: input.timezone,
        reviewMode: input.reviewMode,
        configVersion: { increment: 1 },
      },
    });
    await tx.referenceChannel.deleteMany({ where: { systemId } });
    await tx.referenceChannel.createMany({ data: refRows(ctx.orgId, systemId, input) });
    await tx.scheduleSlot.deleteMany({ where: { systemId } });
    await tx.scheduleSlot.createMany({ data: slotRows(ctx.orgId, systemId, input) });
    await audit(tx, {
      orgId: ctx.orgId,
      actor: { type: "user", userId: ctx.userId },
      action: "system.update",
      targetType: "system",
      targetId: systemId,
      meta: { configVersion: system.configVersion },
    });
    return system;
  });
}

/**
 * Pausieren: keine neuen Zyklen. Konservative Regel: bereits geplante Veröffentlichungen werden
 * zurückgehalten, laufende Produktionen dürfen bis zur Freigabe-Inbox fertig werden.
 */
export async function pauseSystem(ctx: Ctx, systemId: string) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.channelSystem.findFirst({ where: { id: systemId, organizationId: ctx.orgId } });
    if (!s) throw notFound("System");
    if (s.status !== "active") throw new AppError("NOT_ACTIVE", "Das System ist nicht aktiv.", 409);
    await tx.channelSystem.update({ where: { id: systemId }, data: { status: "paused", pausedAt: new Date() } });
    const pubs = await tx.publication.findMany({ where: { systemId, status: "scheduled" }, include: { job: true } });
    for (const p of pubs) {
      await tx.publication.update({ where: { id: p.id }, data: { status: "held", heldReason: "system_paused" } });
      if (p.job.status === "scheduled") await transitionJob(tx, p.job, "held", "System pausiert – Veröffentlichung wird zurückgehalten.");
    }
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "system.pause", targetType: "system", targetId: systemId, meta: { held: pubs.length } });
    return { held: pubs.length };
  });
}

/** Fortsetzen: zukünftige Termine werden wieder geplant; verstrichene brauchen eine Bestätigung. */
export async function resumeSystem(ctx: Ctx, systemId: string) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.channelSystem.findFirst({ where: { id: systemId, organizationId: ctx.orgId }, include: { organization: true } });
    if (!s) throw notFound("System");
    if (s.status !== "paused") throw new AppError("NOT_PAUSED", "Das System ist nicht pausiert.", 409);
    await tx.channelSystem.update({ where: { id: systemId }, data: { status: "active", pausedAt: null } });
    const now = orgNow(s.organization);
    const pubs = await tx.publication.findMany({ where: { systemId, status: "held", heldReason: "system_paused" }, include: { job: true } });
    let resumed = 0;
    let needsConfirmation = 0;
    for (const p of pubs) {
      if (p.scheduledAt.getTime() > now.getTime() + 60_000) {
        await tx.publication.update({ where: { id: p.id }, data: { status: "scheduled", heldReason: null } });
        if (p.job.status === "held") await transitionJob(tx, p.job, "scheduled", "System fortgesetzt – Termin bleibt bestehen.");
        resumed++;
      } else {
        await tx.publication.update({ where: { id: p.id }, data: { heldReason: "slot_passed" } });
        await tx.jobEvent.create({ data: { organizationId: ctx.orgId, jobId: p.jobId, kind: "info", message: "Termin ist während der Pause verstrichen – bitte neuen Termin bestätigen." } });
        needsConfirmation++;
      }
    }
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "system.resume", targetType: "system", targetId: systemId, meta: { resumed, needsConfirmation } });
    return { resumed, needsConfirmation };
  });
}

/** Geordnetes Archivieren: offene Aufträge werden abgebrochen, Reservierungen freigegeben. */
export async function archiveSystem(ctx: Ctx, systemId: string) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.channelSystem.findFirst({ where: { id: systemId, organizationId: ctx.orgId } });
    if (!s) throw notFound("System");
    if (s.status === "archived") return { cancelled: 0 };
    const open = await tx.productionJob.findMany({
      where: { systemId, status: { notIn: ["published", "cancelled", "rejected", "publishing", "reconciling"] } },
    });
    for (const j of open) {
      await transitionJob(tx, j, "cancelled", "System archiviert – Auftrag abgebrochen.", { cancelReason: "System archiviert", nextRunAt: null, lockedBy: null, lockedUntil: null });
      await releaseQuota(tx, j.id, "System archiviert");
    }
    await tx.publication.updateMany({ where: { systemId, status: { in: ["scheduled", "held"] } }, data: { status: "cancelled", slotKey: null, activeJobKey: null } });
    await tx.channelSystem.update({ where: { id: systemId }, data: { status: "archived", archivedAt: new Date(), longformPerPeriod: 0, shortsPerPeriod: 0 } });
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "system.archive", targetType: "system", targetId: systemId, meta: { cancelled: open.length } });
    return { cancelled: open.length };
  });
}

/** Vorschau der nächsten Slots (für Wizard-Zusammenfassung und Systemansicht). */
export function previewSlots(
  slots: { format: "longform" | "short"; weekday: number; localTime: string }[],
  timezone: string,
  now: Date,
  count = 4,
) {
  const to = new Date(now.getTime() + 21 * 86400000);
  return occurrencesBetween(slots, timezone, now, to)
    .slice(0, count)
    .map((o) => ({
      format: o.format,
      at: o.utc.toISOString(),
      label: formatInZone(o.utc, timezone),
      adjustment: o.adjustment,
      adjustmentText: o.adjustment ? adjustmentText[o.adjustment] : null,
    }));
}

export async function saveWizardDraft(ctx: Ctx, step: number, data: unknown) {
  const json = JSON.stringify(data ?? {});
  if (json.length > 20000) throw new AppError("TOO_LARGE", "Entwurf zu groß.", 413);
  return prisma.wizardDraft.upsert({
    where: { organizationId_userId: { organizationId: ctx.orgId, userId: ctx.userId } },
    create: { organizationId: ctx.orgId, userId: ctx.userId, step, data: data as Prisma.InputJsonValue },
    update: { step, data: data as Prisma.InputJsonValue },
  });
}

export async function systemNow(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  return orgNow(org);
}

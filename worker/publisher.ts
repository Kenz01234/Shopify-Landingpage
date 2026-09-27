import type { Publication } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { orgNow } from "@/lib/clock";
import { isEntitled } from "@/lib/billing/subscription";
import { transitionJob } from "@/lib/jobs/service";
import { audit } from "@/lib/audit";
import { publishingProvider } from "@/providers";
import { ProviderError, type PublishInput } from "@/providers/types";

/**
 * Veröffentlicht fällige, freigegebene Inhalte. Vor jedem Upload werden erneut geprüft:
 * aktives Abo, gültige Freigabe genau dieser Version, Kanalzuordnung, Slot und Systemstatus.
 * Hängende Uploads werden abgeglichen statt blind wiederholt.
 */
export async function claimDuePublication(): Promise<Publication | null> {
  const demo = isDemoMode();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Publication" SET "lockedUntil" = now() + interval '5 minutes'
     WHERE "id" = (
       SELECT p."id" FROM "Publication" p JOIN "Organization" o ON o."id" = p."organizationId"
        WHERE p."status" = 'scheduled'
          AND p."scheduledAt" <= now() + (CASE WHEN ${demo} THEN o."demoClockOffsetMinutes" ELSE 0 END) * interval '1 minute'
          AND (p."lockedUntil" IS NULL OR p."lockedUntil" < now())
        ORDER BY p."scheduledAt" ASC
        LIMIT 1
        FOR UPDATE OF p SKIP LOCKED)
    RETURNING "id"`;
  if (!rows.length) return null;
  return prisma.publication.findUnique({ where: { id: rows[0].id } });
}

export async function publishOne(pub: Publication): Promise<string> {
  // 1) Vorabprüfung + Übergang auf „publishing“ atomar
  const pre = await prisma.$transaction(async (tx) => {
    const p = await tx.publication.findUnique({
      where: { id: pub.id },
      include: {
        job: true,
        approval: true,
        version: true,
        system: { include: { organization: { include: { subscription: true, connections: true } } } },
      },
    });
    if (!p || p.status !== "scheduled") return { skip: "Status geändert" };
    const now = orgNow(p.system.organization);
    const hold = async (reason: string, msg: string) => {
      await tx.publication.update({ where: { id: p.id }, data: { status: "held", heldReason: reason, lockedUntil: null } });
      if (p.job.status === "scheduled") await transitionJob(tx, p.job, "held", msg);
      return { skip: reason };
    };
    if (p.system.status === "archived") {
      await tx.publication.update({ where: { id: p.id }, data: { status: "cancelled", slotKey: null, activeJobKey: null } });
      return { skip: "archiviert" };
    }
    if (p.system.status !== "active") return hold("system_paused", "System pausiert – Veröffentlichung zurückgehalten.");
    if (!isEntitled(p.system.organization.subscription, now)) return hold("subscription_inactive", "Abo nicht aktiv – Veröffentlichung zurückgehalten.");
    const approvalValid =
      p.approval.decision === "approved" && !p.approval.revokedAt && p.approval.versionId === p.versionId && p.job.currentVersionId === p.versionId;
    if (!approvalValid || p.job.status !== "scheduled") {
      await tx.publication.update({ where: { id: p.id }, data: { status: "cancelled", slotKey: null, activeJobKey: null, lastError: "Freigabe ungültig" } });
      return { skip: "Freigabe ungültig" };
    }
    if (p.job.targetSlotAt && p.job.targetSlotAt.getTime() !== p.scheduledAt.getTime()) {
      return hold("slot_passed", "Slot-Zuordnung inkonsistent – bitte Termin bestätigen.");
    }
    let connectionId: string | null = null;
    if (p.mode === "live") {
      const yt = p.system.organization.connections.find((c) => c.provider === "youtube");
      if (!yt || yt.status !== "connected") return hold("not_connected", "Kein verbundener YouTube-Kanal – zurückgehalten.");
      connectionId = yt.id;
    }
    await tx.publication.update({ where: { id: p.id }, data: { status: "publishing", attempt: { increment: 1 } } });
    await transitionJob(tx, p.job, "publishing", p.mode === "simulated" ? "Demo-Veröffentlichung läuft (es wird nichts hochgeladen)." : "Upload zu YouTube läuft.");
    const main = await tx.asset.findFirst({
      where: { jobId: p.jobId, generation: p.version.mediaGeneration, kind: p.format === "short" ? "short" : "video" },
    });
    const input: PublishInput = {
      publicationId: p.id,
      orgId: p.organizationId,
      title: p.version.title,
      description: p.version.description,
      tags: p.version.tags,
      format: p.format,
      scheduledAt: p.scheduledAt,
      videoStorageKey: main?.storageKey ?? null,
      connectionId,
    };
    return { input, jobId: p.jobId, orgId: p.organizationId, mode: p.mode };
  });
  if ("skip" in pre) return `skip:${pre.skip}`;

  // 2) Veröffentlichung außerhalb der Transaktion
  let result;
  try {
    result = await publishingProvider().publish(pre.input);
  } catch (e) {
    const msg = e instanceof ProviderError ? e.message : (e as Error).message;
    await finalize(pub.id, pre.jobId, pre.orgId, { status: "failed", error: msg });
    return `failed:${msg}`;
  }
  if (result.status === "unknown") {
    await finalize(pub.id, pre.jobId, pre.orgId, { status: "reconciling", error: result.detail });
    return "reconciling";
  }
  await finalize(pub.id, pre.jobId, pre.orgId, { status: result.status, providerVideoId: result.providerVideoId });
  return result.status;
}

async function finalize(
  pubId: string,
  jobId: string,
  orgId: string,
  r: { status: "simulated" | "published" | "failed" | "reconciling"; providerVideoId?: string; error?: string },
) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.productionJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (r.status === "simulated" || r.status === "published") {
      await tx.publication.update({
        where: { id: pubId },
        data: { status: r.status, providerVideoId: r.providerVideoId, publishedAt: new Date(), slotKey: null, activeJobKey: null, lockedUntil: null },
      });
      await transitionJob(tx, job, "published", r.status === "simulated" ? "Demo-Veröffentlichung simuliert – nichts wurde zu YouTube hochgeladen." : `Veröffentlicht (YouTube-ID ${r.providerVideoId}).`);
    } else if (r.status === "reconciling") {
      await tx.publication.update({ where: { id: pubId }, data: { status: "reconciling", lastError: r.error, lockedUntil: null } });
      await transitionJob(tx, job, "reconciling", "Antwort des Upload-Dienstes unklar – wird abgeglichen, nicht erneut hochgeladen.");
    } else {
      await tx.publication.update({ where: { id: pubId }, data: { status: "failed", lastError: r.error, slotKey: null, activeJobKey: null, lockedUntil: null } });
      await transitionJob(tx, job, "failed", `Veröffentlichung fehlgeschlagen: ${r.error}`, { failedStep: "publishing" as never, lastErrorMessage: r.error });
    }
    await audit(tx, { orgId, actor: { type: "worker" }, action: `publication.${r.status}`, targetType: "publication", targetId: pubId, meta: { providerVideoId: r.providerVideoId } });
  });
}

/** Hängende „publishing“-Einträge (Worker-Absturz) werden nie neu hochgeladen, sondern abgeglichen. */
export async function recoverStalePublishing() {
  const stale = await prisma.publication.findMany({ where: { status: "publishing", lockedUntil: { lt: new Date() } } });
  for (const p of stale) {
    await prisma.$transaction(async (tx) => {
      const job = await tx.productionJob.findUnique({ where: { id: p.jobId } });
      await tx.publication.update({ where: { id: p.id }, data: { status: "reconciling", lastError: "Worker-Unterbrechung während des Uploads" } });
      if (job?.status === "publishing") await transitionJob(tx, job, "reconciling", "Upload wurde unterbrochen – Ergebnis wird abgeglichen statt neu hochgeladen.");
    });
  }
  return stale.length;
}

export async function reconcileOne(): Promise<number> {
  const list = await prisma.publication.findMany({
    where: { status: "reconciling", OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    include: { version: true, job: true },
    take: 5,
  });
  for (const p of list) {
    await prisma.publication.update({ where: { id: p.id }, data: { lockedUntil: new Date(Date.now() + 10 * 60_000) } });
    const r = await publishingProvider()
      .reconcile({
        publicationId: p.id,
        orgId: p.organizationId,
        title: p.version.title,
        description: p.version.description,
        tags: p.version.tags,
        format: p.format,
        scheduledAt: p.scheduledAt,
        videoStorageKey: null,
        connectionId: null,
      })
      .catch(() => ({ status: "unknown" as const }));
    if (r.status === "published") {
      await finalize(p.id, p.jobId, p.organizationId, { status: p.mode === "simulated" ? "simulated" : "published", providerVideoId: r.providerVideoId });
    } else if (r.status === "not_found") {
      await finalize(p.id, p.jobId, p.organizationId, { status: "failed", error: "Upload nicht gefunden – bitte bewusst neu einplanen." });
    }
  }
  return list.length;
}

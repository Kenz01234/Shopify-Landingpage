import type { Publication, PublicationTarget } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { orgNow } from "@/lib/clock";
import { isEntitled } from "@/lib/billing/subscription";
import { transitionJob } from "@/lib/jobs/service";
import { audit } from "@/lib/audit";
import { signedMediaUrl } from "@/lib/media-links";
import { captionFor, PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { publishingProvider } from "@/providers";
import { ProviderError, type PublishInput } from "@/providers/types";

/**
 * Veröffentlicht fällige, freigegebene Inhalte auf allen Plattformen des Auftrags (YouTube, Instagram, TikTok).
 * Vor dem Upload werden erneut geprüft: aktives Abo, gültige Freigabe genau dieser Version, Slot, Systemstatus
 * und – für echte Uploads – die Verbindung jeder Plattform.
 * Jede Plattform wird einzeln verbucht (PublicationTarget). Unklare Antworten und Abstürze führen zum Abgleich,
 * nie zu einem zweiten Upload. Bereits erledigte Plattformen werden nie wiederholt.
 */
/** Liegt ein Termin weiter zurück (z. B. nach Worker-Ausfall), wird nicht verspätet veröffentlicht, sondern neu bestätigt. */
export const LATE_TOLERANCE_MIN = 60;
/** Sperre je Plattform-Upload (YouTube-Uploads großer Dateien dürfen bis zu 30 Minuten dauern) */
const TARGET_LOCK_MS = 40 * 60_000;

export const DEMO_SCENARIO_PUBLISH_FAILURE = "instagram_failure";

const names = (list: { platform: PlatformKey }[]) => list.map((t) => PLATFORMS[t.platform].label).join(", ");

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

type Base = Omit<PublishInput, "targetId" | "platform" | "caption" | "connectionId" | "publicVideoUrl" | "uploadId" | "onUploadId" | "demoFail"> & {
  caption: { caption: string | null; title: string; tags: string[] };
  assetId: string | null;
  demoScenario: string;
};

function inputFor(base: Base, t: PublicationTarget, connectionId: string | null): PublishInput {
  return {
    ...base,
    targetId: t.id,
    platform: t.platform as PlatformKey,
    caption: captionFor(base.caption, t.platform as PlatformKey),
    connectionId,
    uploadId: t.providerUploadId,
    publicVideoUrl: t.platform === "instagram" && t.mode === "live" && base.assetId ? signedMediaUrl(base.assetId) : null,
    onUploadId: async (id) => {
      await prisma.publicationTarget.update({ where: { id: t.id }, data: { providerUploadId: id } });
    },
    demoFail: t.mode === "simulated" && base.demoScenario === DEMO_SCENARIO_PUBLISH_FAILURE && t.platform === "instagram",
  };
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
        targets: true,
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
    if (now.getTime() - p.scheduledAt.getTime() > LATE_TOLERANCE_MIN * 60_000) {
      return hold("slot_passed", `Termin liegt mehr als ${LATE_TOLERANCE_MIN} Minuten zurück – nicht verspätet veröffentlicht. Bitte neuen Termin bestätigen.`);
    }
    if (p.job.targetSlotAt && p.job.targetSlotAt.getTime() !== p.scheduledAt.getTime()) {
      return hold("slot_passed", "Slot-Zuordnung inkonsistent – bitte Termin bestätigen.");
    }
    const pending = p.targets.filter((t) => t.status === "pending");
    const connections: Partial<Record<PlatformKey, string>> = {};
    for (const t of pending.filter((x) => x.mode === "live")) {
      const c = p.system.organization.connections.find((x) => x.provider === t.platform);
      if (!c || c.status !== "connected") return hold("not_connected", `Kein verbundenes ${PLATFORMS[t.platform as PlatformKey].label}-Konto – zurückgehalten.`);
      connections[t.platform as PlatformKey] = c.id;
    }
    if (!pending.length) return { settleOnly: true as const };
    await tx.publication.update({ where: { id: p.id }, data: { status: "publishing", attempt: { increment: 1 }, lockedUntil: new Date(Date.now() + TARGET_LOCK_MS) } });
    const simulated = pending.every((t) => t.mode === "simulated");
    await transitionJob(
      tx,
      p.job,
      "publishing",
      simulated ? `Demo-Veröffentlichung auf ${names(pending)} läuft (es wird nichts hochgeladen).` : `Upload zu ${names(pending)} läuft.`,
    );
    const main = await tx.asset.findFirst({
      where: { jobId: p.jobId, generation: p.version.mediaGeneration, kind: p.format === "short" ? "short" : "video" },
    });
    const base: Base = {
      publicationId: p.id,
      orgId: p.organizationId,
      title: p.version.title,
      description: p.version.description,
      tags: p.version.tags,
      format: p.format,
      scheduledAt: p.scheduledAt,
      videoStorageKey: main?.storageKey ?? null,
      caption: { caption: p.version.caption, title: p.version.title, tags: p.version.tags },
      assetId: main?.id ?? null,
      demoScenario: p.job.demoScenario,
    };
    return { base, targets: pending, connections };
  });
  if ("skip" in pre) return `skip:${pre.skip}`;
  if ("settleOnly" in pre) return settlePublication(pub.id);

  // 2) Uploads außerhalb der Transaktion – Plattform für Plattform, jede einzeln verbucht
  for (const t of pre.targets) {
    await prisma.publication.update({ where: { id: pub.id }, data: { lockedUntil: new Date(Date.now() + TARGET_LOCK_MS) } });
    await prisma.publicationTarget.update({ where: { id: t.id }, data: { status: "publishing", attempt: { increment: 1 } } });
    const input = inputFor(pre.base, t, pre.connections[t.platform as PlatformKey] ?? null);
    try {
      const r = await publishingProvider(t.platform as PlatformKey).publish(input);
      if (r.status === "unknown") {
        await prisma.publicationTarget.update({ where: { id: t.id }, data: { status: "reconciling", lastError: r.detail } });
      } else {
        await prisma.publicationTarget.update({
          where: { id: t.id },
          data: { status: r.status, providerPostId: r.providerPostId, url: r.url ?? null, publishedAt: new Date(), lastError: null },
        });
      }
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : (e as Error).message;
      await prisma.publicationTarget.update({ where: { id: t.id }, data: { status: "failed", lastError: msg } });
    }
  }
  return settlePublication(pub.id);
}

/**
 * Fasst den Stand aller Plattformen zusammen und setzt Veröffentlichung und Auftrag entsprechend:
 * - eine Plattform unklar → Abgleich
 * - noch offene Plattformen (z. B. nach Abgleich) → wieder „geplant“, der Worker macht dort weiter
 * - eine Plattform fehlgeschlagen → fehlgeschlagen (erledigte bleiben erledigt; Wiederholung nur der fehlgeschlagenen)
 * - alle erledigt → veröffentlicht (bzw. simuliert)
 */
export async function settlePublication(pubId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.publication.findUnique({ where: { id: pubId }, include: { targets: true, job: true } });
    if (!p) return "fehlt";
    const job = p.job;
    const by = (s: string) => p.targets.filter((t) => t.status === s);
    const done = p.targets.filter((t) => t.status === "simulated" || t.status === "published");
    if (by("publishing").length) return "läuft";
    let result: string;
    if (by("reconciling").length) {
      await tx.publication.update({ where: { id: p.id }, data: { status: "reconciling", lockedUntil: null } });
      if (job.status === "publishing") {
        await transitionJob(tx, job, "reconciling", `Antwort von ${names(by("reconciling"))} unklar – wird abgeglichen, nicht erneut hochgeladen.`);
      }
      result = "reconciling";
    } else if (by("pending").length) {
      await tx.publication.update({ where: { id: p.id }, data: { status: "scheduled", lockedUntil: null } });
      if (job.status === "reconciling" || job.status === "publishing") {
        await transitionJob(tx, job, "scheduled", `${job.status === "reconciling" ? "Abgleich abgeschlossen" : "Nach Unterbrechung"} – ${names(by("pending"))} folgt.`);
      }
      result = "scheduled";
    } else if (by("failed").length) {
      const failed = by("failed");
      const summary = `${failed.map((t) => `${PLATFORMS[t.platform as PlatformKey].label}: ${t.lastError ?? "Fehler"}`).join(" · ")}`;
      await tx.publication.update({ where: { id: p.id }, data: { status: "failed", lastError: summary, slotKey: null, activeJobKey: null, lockedUntil: null } });
      const okText = done.length ? ` ${names(done)} ${done.every((t) => t.status === "simulated") ? "simuliert" : "veröffentlicht"}.` : "";
      await transitionJob(tx, job, "failed", `Veröffentlichung auf ${names(failed)} fehlgeschlagen.${okText} ${summary}`, {
        failedStep: "publishing" as never,
        lastErrorMessage: summary,
      });
      result = "failed";
    } else {
      const simulated = done.every((t) => t.status === "simulated");
      const youtube = done.find((t) => t.platform === "youtube");
      await tx.publication.update({
        where: { id: p.id },
        data: {
          status: simulated ? "simulated" : "published",
          providerVideoId: youtube?.providerPostId ?? done[0]?.providerPostId ?? null,
          publishedAt: new Date(),
          slotKey: null,
          activeJobKey: null,
          lockedUntil: null,
          lastError: null,
        },
      });
      if (job.status === "publishing" || job.status === "reconciling") {
        await transitionJob(
          tx,
          job,
          "published",
          simulated ? `Demo-Veröffentlichung auf ${names(done)} simuliert – nichts wurde hochgeladen.` : `Veröffentlicht auf ${names(done)}.`,
        );
      }
      result = simulated ? "simulated" : "published";
    }
    await audit(tx, {
      orgId: p.organizationId,
      actor: { type: "worker" },
      action: `publication.${result}`,
      targetType: "publication",
      targetId: p.id,
      meta: { targets: p.targets.map((t) => ({ platform: t.platform, status: t.status, id: t.providerPostId })) },
    });
    return result;
  });
}

/** Hängende Uploads (Worker-Absturz) werden nie neu hochgeladen, sondern abgeglichen. */
export async function recoverStalePublishing() {
  const stale = await prisma.publication.findMany({ where: { status: "publishing", lockedUntil: { lt: new Date() } } });
  for (const p of stale) {
    await prisma.publicationTarget.updateMany({ where: { publicationId: p.id, status: "publishing" }, data: { status: "reconciling", lastError: "Worker-Unterbrechung während des Uploads" } });
    await settlePublication(p.id);
  }
  return stale.length;
}

export async function reconcileOne(): Promise<number> {
  const list = await prisma.publication.findMany({
    where: { status: "reconciling", OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    include: { version: true, job: true, targets: true, organization: { include: { connections: true } } },
    take: 5,
  });
  for (const p of list) {
    await prisma.publication.update({ where: { id: p.id }, data: { lockedUntil: new Date(Date.now() + 10 * 60_000) } });
    const base: Base = {
      publicationId: p.id,
      orgId: p.organizationId,
      title: p.version.title,
      description: p.version.description,
      tags: p.version.tags,
      format: p.format,
      scheduledAt: p.scheduledAt,
      videoStorageKey: null,
      caption: { caption: p.version.caption, title: p.version.title, tags: p.version.tags },
      assetId: null,
      demoScenario: p.job.demoScenario,
    };
    for (const t of p.targets.filter((x) => x.status === "reconciling")) {
      const conn = p.organization.connections.find((c) => c.provider === t.platform && c.status === "connected");
      const r = await publishingProvider(t.platform as PlatformKey)
        .reconcile(inputFor(base, t, conn?.id ?? null))
        .catch(() => ({ status: "unknown" as const }));
      if (r.status === "published") {
        await prisma.publicationTarget.update({
          where: { id: t.id },
          data: { status: t.mode === "simulated" ? "simulated" : "published", providerPostId: r.providerPostId, url: r.url ?? null, publishedAt: new Date(), lastError: null },
        });
      } else if (r.status === "not_found") {
        await prisma.publicationTarget.update({ where: { id: t.id }, data: { status: "failed", lastError: "Upload nicht gefunden – bitte bewusst erneut veröffentlichen." } });
      }
    }
    await settlePublication(p.id);
  }
  return list.length;
}

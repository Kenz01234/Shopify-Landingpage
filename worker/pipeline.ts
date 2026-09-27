import path from "node:path";
import fs from "node:fs";
import type { JobStatus, Prisma, ProductionJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { transitionJob, jobNote } from "@/lib/jobs/service";
import { applyFailure } from "@/lib/jobs/failure";
import { consumeQuota } from "@/lib/quota";
import { runAutoCheck } from "@/lib/autocheck";
import { isEntitled } from "@/lib/billing/subscription";
import { orgNow } from "@/lib/clock";
import { env, isDemoMode } from "@/lib/env";
import { nextFreeOccurrences, formatInZone } from "@/lib/time";
import { occupiedSlots } from "@/lib/jobs/service";
import { safeDownload } from "@/lib/safe-fetch";
import { uploadsDir } from "@/lib/storage";
import { productionProvider, voiceProvider } from "@/providers";
import { ProviderError, type ConfigSnapshot, type JobContext, type MediaResult, type SourceNote, type WorkingData } from "@/providers/types";
import { sceneForNiche } from "@/lib/demo/content";

/**
 * Führt genau EINEN Schritt eines Auftrags aus und gibt die Sperre wieder frei.
 * Jeder Schritt ist wiederholbar: Ergebnisse landen in workingData, Status wechselt erst danach
 * (optimistisch – ein zwischenzeitlicher Abbruch gewinnt immer).
 */

const LEASE_MS = 60_000;

export async function claimNextJob(workerId: string): Promise<ProductionJob | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "ProductionJob" SET "lockedBy" = ${workerId}, "lockedUntil" = now() + (${LEASE_MS} * interval '1 millisecond')
     WHERE "id" = (
       SELECT "id" FROM "ProductionJob"
        WHERE "status" IN ('queued','researching','scripting','voiceover','rendering','quality_check','changes_requested','retry_scheduled')
          AND "awaitingExternal" = false
          AND ("nextRunAt" IS NULL OR "nextRunAt" <= now())
          AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
        ORDER BY COALESCE("nextRunAt", "createdAt") ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
    RETURNING "id"`;
  if (!rows.length) return null;
  return prisma.productionJob.findUnique({ where: { id: rows[0].id } });
}

async function release(jobId: string, workerId: string, delayMs: number | null) {
  await prisma.productionJob.updateMany({
    where: { id: jobId, lockedBy: workerId },
    data: { lockedBy: null, lockedUntil: null, ...(delayMs !== null ? { nextRunAt: new Date(Date.now() + delayMs) } : {}) },
  });
}

function ctxOf(job: ProductionJob): JobContext {
  return {
    jobId: job.id,
    orgId: job.organizationId,
    systemId: job.systemId,
    format: job.format,
    attempt: job.attempt,
    revision: job.revisionCount,
    revisionNote: job.revisionNote,
    demoScenario: job.demoScenario,
    config: job.configSnapshot as unknown as ConfigSnapshot,
    idempotencyKey: job.idempotencyKey,
    workingData: (job.workingData ?? {}) as WorkingData,
  };
}

const stepDelay = () => (isDemoMode() ? env().DEMO_STEP_MS : 0);

export async function processJob(job: ProductionJob, workerId: string): Promise<string> {
  const ctx = ctxOf(job);
  const wd = ctx.workingData;
  const step: JobStatus = job.status === "retry_scheduled" ? (job.retryStep ?? "queued") : job.status;

  try {
    // Wartezustände: pausiertes System oder fehlendes Abo → neue Produktionen starten nicht.
    if (job.status === "queued") {
      const system = await prisma.channelSystem.findUnique({ where: { id: job.systemId }, include: { organization: { include: { subscription: true } } } });
      if (!system || system.status === "archived") {
        await transitionJob(prisma, job, "cancelled", "System archiviert – Auftrag nicht gestartet.", { lockedBy: null, lockedUntil: null });
        return "cancelled";
      }
      const now = orgNow(system.organization);
      if (system.status === "paused" || !isEntitled(system.organization.subscription, now)) {
        await release(job.id, workerId, 30_000);
        return "waiting";
      }
    }

    if (job.status === "retry_scheduled") {
      await transitionJob(prisma, job, step, `Neuer Versuch (${job.attempt + 1}/${job.maxAttempts}).`, { lockedBy: workerId });
      await release(job.id, workerId, 0);
      return "retry-resumed";
    }

    const production = productionProvider();

    switch (step) {
      case "queued": {
        const resume = wd.resumeFrom as JobStatus | undefined;
        if (production.mode === "live" && production.dispatch) {
          const { runId } = await production.dispatch(ctx);
          await transitionJob(prisma, job, "researching", `An n8n übergeben und angenommen (Lauf ${runId}).`, {
            externalRunId: runId,
            externalAcceptedAt: new Date(),
            awaitingExternal: true,
            lastExternalSeq: 0,
            lockedBy: null,
            lockedUntil: null,
            nextRunAt: null,
          });
          return "dispatched";
        }
        const target: JobStatus = resume && ["scripting", "voiceover", "rendering", "quality_check"].includes(resume) ? resume : "researching";
        await transitionJob(prisma, job, target, isDemoMode() ? "Demoproduktion gestartet." : "Produktion gestartet.", {
          workingData: { ...wd, resumeFrom: undefined } as Prisma.InputJsonValue,
        });
        await release(job.id, workerId, stepDelay());
        return target;
      }

      case "researching": {
        const r = await production.research(ctx);
        const next: WorkingData = { ...wd, topic: r.topic, proposals: r.proposals, researchSummary: r.summary, sources: r.sources, scene: r.scene };
        if (ctx.config.reviewMode === "topic_and_final" && !wd.topicApproved) {
          const version = await createVersion(job, "topic", {
            title: r.topic,
            description: `${r.summary}\n\nWeitere Vorschläge: ${r.proposals.filter((p) => p !== r.topic).join(" · ")}`,
            script: "Das Skript entsteht nach deiner Bestätigung des Themas.",
            thumbnailText: "",
            tags: [],
            sources: r.sources,
          });
          await transitionJob(prisma, job, "awaiting_topic_approval", `Themenvorschlag „${r.topic}“ wartet auf deine Bestätigung.`, {
            topic: r.topic,
            currentVersionId: version.id,
            workingData: next as Prisma.InputJsonValue,
            lockedBy: null,
            lockedUntil: null,
            nextRunAt: null,
          });
          return "awaiting-topic";
        }
        await transitionJob(prisma, job, "scripting", `Recherche abgeschlossen: „${r.topic}“.`, { topic: r.topic, workingData: next as Prisma.InputJsonValue });
        await release(job.id, workerId, stepDelay());
        return "scripting";
      }

      case "scripting": {
        const s = await production.script(ctx);
        // Ein bereits bestätigtes/manuell bearbeitetes Skript bleibt maßgeblich.
        const script = wd.scriptApproved && wd.script ? wd.script : s.script;
        const next: WorkingData = { ...wd, script, title: wd.title ?? s.title, description: s.description, tags: s.tags, thumbnailText: s.thumbnailText, caption: s.caption ?? wd.caption };
        if (job.revisionCount > 0 && !wd.scriptApproved) next.title = s.title;
        if (ctx.config.reviewMode === "script_and_final" && !wd.scriptApproved) {
          const version = await createVersion(job, "script", {
            title: next.title ?? s.title,
            description: s.description,
            script,
            thumbnailText: s.thumbnailText,
            tags: s.tags,
            sources: wd.sources ?? [],
          });
          await transitionJob(prisma, job, "awaiting_script_approval", "Skript wartet auf deine Bestätigung.", {
            currentVersionId: version.id,
            workingData: next as Prisma.InputJsonValue,
            lockedBy: null,
            lockedUntil: null,
            nextRunAt: null,
          });
          return "awaiting-script";
        }
        await transitionJob(prisma, job, "voiceover", "Skript fertig.", { workingData: next as Prisma.InputJsonValue });
        await release(job.id, workerId, stepDelay());
        return "voiceover";
      }

      case "changes_requested": {
        const resume = (wd.resumeFrom as JobStatus | undefined) ?? "scripting";
        const target: JobStatus = resume === "voiceover" ? "voiceover" : "scripting";
        await transitionJob(prisma, job, target, target === "voiceover" ? "Überarbeitung: Vertonung mit geändertem Skript." : "Überarbeitung: Skript wird angepasst.", {
          workingData: { ...wd, resumeFrom: undefined, scriptApproved: target === "voiceover" ? true : wd.scriptApproved } as Prisma.InputJsonValue,
        });
        await release(job.id, workerId, stepDelay());
        return target;
      }

      case "voiceover": {
        const audio = await voiceProvider().synthesize(ctx, wd.script ?? "");
        // Generation = Revisionsstand: technische Wiederholungen schreiben in dieselbe Generation (idempotent).
        const generation = job.revisionCount + 1;
        const asset = await saveAsset(job, audio, generation);
        await transitionJob(prisma, job, "rendering", audio.origin === "demo_fixture" ? "Demo-Vertonung zugeordnet (lokale Beispielstimme)." : "Vertonung erstellt.", {
          workingData: { ...wd, audioAssetId: asset.id, generation } as Prisma.InputJsonValue,
        });
        await release(job.id, workerId, stepDelay());
        return "rendering";
      }

      case "rendering": {
        const media = await production.render(ctx);
        const generation = wd.generation ?? job.revisionCount + 1;
        for (const m of media) await saveAsset(job, m, generation);
        await transitionJob(prisma, job, "quality_check", isDemoMode() ? "Demo-Video zugeordnet (Beispielausschnitt)." : "Video erstellt.", {
          workingData: { ...wd, generation } as Prisma.InputJsonValue,
        });
        await release(job.id, workerId, stepDelay());
        return "quality_check";
      }

      case "quality_check": {
        await downloadPendingMedia(job, wd);
        return await finishQualityCheck(job, workerId);
      }

      default:
        await release(job.id, workerId, 5_000);
        return "skip";
    }
  } catch (e) {
    const err =
      e instanceof ProviderError
        ? { code: e.code, message: e.message, retryable: e.retryable, provider: e.provider }
        : { code: "INTERNAL", message: `Interner Fehler: ${(e as Error).message}`, retryable: true };
    // Konflikt (z. B. Abbruch parallel) → Sperre lösen, nichts überschreiben.
    if ((e as { code?: string }).code === "CONFLICT") {
      await release(job.id, workerId, null);
      return "conflict";
    }
    try {
      const fresh = await prisma.productionJob.findUnique({ where: { id: job.id } });
      if (fresh && fresh.status === job.status) await applyFailure(prisma, fresh, step, err);
      else await release(job.id, workerId, null);
    } catch {
      await release(job.id, workerId, 10_000);
    }
    return `error:${err.code}`;
  }
}

async function nextGeneration(jobId: string) {
  const agg = await prisma.asset.aggregate({ where: { jobId }, _max: { generation: true } });
  return (agg._max.generation ?? 0) + 1;
}

async function saveAsset(job: ProductionJob, m: MediaResult, generation: number) {
  const existing = await prisma.asset.findFirst({ where: { jobId: job.id, generation, kind: m.kind } });
  if (existing) return existing;
  return prisma.asset.create({
    data: {
      organizationId: job.organizationId,
      jobId: job.id,
      generation,
      kind: m.kind,
      storageKey: m.storageKey,
      fileName: m.fileName,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      durationSec: m.durationSec,
      width: m.width,
      height: m.height,
      origin: m.origin,
      rightsStatus: m.rightsStatus,
      sourceLabel: m.sourceLabel,
      license: m.license,
      editNote: m.editNote,
    },
  });
}

async function createVersion(
  job: ProductionJob,
  stage: "topic" | "script" | "final",
  v: { title: string; description: string; script: string; thumbnailText: string; tags: string[]; sources: SourceNote[] },
  generation = 0,
) {
  const snapshot = job.configSnapshot as unknown as ConfigSnapshot;
  const assets = generation ? await prisma.asset.findMany({ where: { jobId: job.id, generation } }) : [];
  const check = runAutoCheck({
    ...v,
    format: job.format,
    targetSeconds: job.format === "short" ? snapshot.shortSeconds : snapshot.longformMinutes * 60,
    media: assets.map((a) => ({ kind: a.kind, durationSec: a.durationSec })),
    isDemo: isDemoMode(),
    stage,
  });
  const last = await prisma.contentVersion.aggregate({ where: { jobId: job.id }, _max: { number: true } });
  const main = assets.find((a) => a.kind === (job.format === "short" ? "short" : "video"));
  return prisma.contentVersion.create({
    data: {
      organizationId: job.organizationId,
      jobId: job.id,
      number: (last._max.number ?? 0) + 1,
      stage,
      title: v.title.slice(0, 100),
      description: v.description,
      script: v.script,
      thumbnailText: v.thumbnailText,
      tags: v.tags,
      sources: v.sources as unknown as Prisma.InputJsonValue,
      autoCheck: check as unknown as Prisma.InputJsonValue,
      createdByType: "system",
      changeNote: job.revisionCount > 0 && stage === "final" ? `Überarbeitung ${job.revisionCount}${job.revisionNote ? `: ${job.revisionNote}` : ""}` : null,
      mediaGeneration: generation,
      durationSec: main?.durationSec ? Math.round(main.durationSec) : null,
    },
  });
}

/** Live-Modus: von n8n gemeldete Medien kontrolliert herunterladen (Allowlist, Größenlimit). */
async function downloadPendingMedia(job: ProductionJob, wd: WorkingData & { pendingMedia?: PendingMedia[] }) {
  const pending = wd.pendingMedia ?? [];
  if (!pending.length) return;
  const e = env();
  const allowed = (e.ASSET_DOWNLOAD_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) throw new ProviderError("DOWNLOAD_NOT_ALLOWED", "ASSET_DOWNLOAD_ALLOWED_HOSTS ist leer – externe Medien werden nicht geladen.", false, "storage");
  const generation = wd.generation ?? (await nextGeneration(job.id));
  const dir = path.join(uploadsDir(), job.organizationId, job.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, m] of pending.entries()) {
    const file = `${m.kind}-g${generation}-${i}${m.kind === "audio" ? ".mp3" : ".mp4"}`;
    const dest = path.join(dir, file);
    const r = await safeDownload(m.url, dest, { allowedHosts: allowed, maxBytes: e.ASSET_DOWNLOAD_MAX_MB * 1024 * 1024 });
    await saveAsset(
      job,
      {
        kind: m.kind,
        storageKey: `uploads/${job.organizationId}/${job.id}/${file}`,
        fileName: file,
        mimeType: m.mimeType ?? r.mimeType,
        sizeBytes: r.bytes,
        durationSec: m.durationSec,
        origin: "n8n",
        rightsStatus: m.rightsStatus ?? "unknown",
        sourceLabel: m.sourceLabel,
        license: m.license,
      },
      generation,
    );
  }
  await prisma.productionJob.update({
    where: { id: job.id },
    data: { workingData: { ...wd, pendingMedia: [], generation } as Prisma.InputJsonValue },
  });
  job.workingData = { ...wd, pendingMedia: [], generation } as Prisma.JsonValue;
}

export type PendingMedia = {
  kind: "video" | "short" | "audio";
  url: string;
  mimeType?: string;
  durationSec?: number;
  rightsStatus?: "own_production" | "licensed" | "public_domain" | "unknown" | "needs_review";
  sourceLabel?: string;
  license?: string;
};

/** Automatische Prüfung → neue finale Version → Kontingentverbrauch → Freigabe-Inbox. */
async function finishQualityCheck(job: ProductionJob, workerId: string) {
  const fresh = (await prisma.productionJob.findUnique({ where: { id: job.id } }))!;
  const wd = (fresh.workingData ?? {}) as WorkingData;
  const snapshot = fresh.configSnapshot as unknown as ConfigSnapshot;
  const generation = wd.generation ?? 0;
  const result = await prisma.$transaction(async (tx) => {
    const version = await (async () => {
      const assets = await tx.asset.findMany({ where: { jobId: job.id, generation } });
      const scene = wd.scene ?? sceneForNiche(snapshot.niche, snapshot.name);
      void scene;
      const input = {
        title: wd.title ?? wd.topic ?? "Ohne Titel",
        description: wd.description ?? "",
        script: wd.script ?? "",
        thumbnailText: wd.thumbnailText ?? "",
        tags: wd.tags ?? [],
        sources: wd.sources ?? [],
      };
      const check = runAutoCheck({
        ...input,
        format: fresh.format,
        targetSeconds: fresh.format === "short" ? snapshot.shortSeconds : snapshot.longformMinutes * 60,
        media: assets.map((a) => ({ kind: a.kind, durationSec: a.durationSec })),
        isDemo: isDemoMode(),
        stage: "final",
      });
      const last = await tx.contentVersion.aggregate({ where: { jobId: job.id }, _max: { number: true } });
      const main = assets.find((a) => a.kind === (fresh.format === "short" ? "short" : "video"));
      return tx.contentVersion.create({
        data: {
          organizationId: fresh.organizationId,
          jobId: fresh.id,
          number: (last._max.number ?? 0) + 1,
          stage: "final",
          title: input.title.slice(0, 100),
          description: input.description,
          script: input.script,
          thumbnailText: input.thumbnailText,
          tags: input.tags,
          caption: fresh.format === "short" ? (wd.caption ?? null) : null,
          sources: input.sources as unknown as Prisma.InputJsonValue,
          autoCheck: check as unknown as Prisma.InputJsonValue,
          createdByType: "system",
          changeNote: fresh.revisionCount > 0 ? `Überarbeitung ${fresh.revisionCount}${fresh.revisionNote ? `: ${fresh.revisionNote}` : ""}` : null,
          mediaGeneration: generation,
          durationSec: main?.durationSec ? Math.round(main.durationSec) : null,
        },
      });
    })();
    await tx.asset.updateMany({ where: { jobId: job.id, generation, versionId: null }, data: { versionId: version.id } });
    const consumed = await consumeQuota(tx, fresh.id);

    // Wenn der Ziel-Slot bereits verstrichen ist: nicht veröffentlichen, sondern neuen Slot vorschlagen.
    const system = await tx.channelSystem.findUnique({ where: { id: fresh.systemId }, include: { slots: true, organization: true } });
    let missed: { suggested: Date | null } | null = null;
    if (system && fresh.targetSlotAt) {
      const now = orgNow(system.organization);
      if (fresh.targetSlotAt.getTime() <= now.getTime()) {
        const occ = await occupiedSlots(tx, fresh.systemId, fresh.format, fresh.id);
        const [s] = nextFreeOccurrences(system.slots, system.timezone, fresh.format, new Date(now.getTime() + 5 * 60_000), occ, 1);
        missed = { suggested: s?.utc ?? null };
      }
    }
    await transitionJob(
      tx,
      fresh,
      "awaiting_approval",
      `Version ${version.number} ist fertig und wartet auf deine Freigabe.${consumed ? " Kontingent verbraucht." : ""}${missed ? ` Ursprünglicher Termin verstrichen – Vorschlag: ${missed.suggested ? formatInZone(missed.suggested, system!.timezone) : "kein freier Slot"}.` : ""}`,
      {
        currentVersionId: version.id,
        lockedBy: null,
        lockedUntil: null,
        nextRunAt: null,
        attempt: 0,
        ...(missed ? { slotMissedAt: new Date(), suggestedSlotAt: missed.suggested } : {}),
      },
    );
    return version;
  });
  void workerId;
  await jobNote(prisma, fresh, `Automatische Prüfung abgeschlossen – das ist keine Freigabe.`, "info");
  return `awaiting_approval:v${result.number}`;
}

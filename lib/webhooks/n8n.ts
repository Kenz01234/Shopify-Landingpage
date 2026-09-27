import { z } from "zod";
import type { JobStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifySignature } from "@/lib/crypto";
import { isUniqueViolation } from "@/lib/errors";
import { transitionJob } from "@/lib/jobs/service";
import { applyFailure } from "@/lib/jobs/failure";

/**
 * Verarbeitung authentifizierter n8n-Rückmeldungen.
 * Schutz gegen Duplikate (WebhookEvent eindeutig), veraltete Läufe (runId), verspätete oder
 * vertauschte Meldungen (seq) und Meldungen zu abgebrochenen/abgeschlossenen Aufträgen.
 */
const mediaSchema = z.object({
  kind: z.enum(["video", "short", "audio"]),
  url: z.string().url().max(2000),
  mimeType: z.string().max(100).optional(),
  durationSec: z.number().positive().max(60 * 60 * 3).optional(),
  rightsStatus: z.enum(["own_production", "licensed", "public_domain", "unknown", "needs_review"]).optional(),
  sourceLabel: z.string().max(300).optional(),
  license: z.string().max(300).optional(),
});

const sourceSchema = z.object({
  id: z.string().max(64),
  type: z.enum(["fact", "footage", "music", "voice"]),
  title: z.string().max(300),
  publisher: z.string().max(200).nullish(),
  url: z.string().url().max(2000).nullish(),
  note: z.string().max(1000).nullish(),
  rightsStatus: z.enum(["own_production", "demo_fixture", "licensed", "public_domain", "unknown", "needs_review", "not_applicable"]),
});

export const n8nCallbackSchema = z.object({
  eventId: z.string().min(8).max(200),
  jobId: z.string().min(1).max(64),
  runId: z.string().min(1).max(200),
  seq: z.number().int().min(1),
  type: z.enum(["status", "result", "error"]),
  status: z.enum(["researching", "scripting", "voiceover", "rendering"]).optional(),
  result: z
    .object({
      topic: z.string().max(300),
      title: z.string().max(100),
      description: z.string().max(5000),
      script: z.string().max(60000),
      tags: z.array(z.string().max(60)).max(30),
      thumbnailText: z.string().max(60),
      sources: z.array(sourceSchema).max(50),
      media: z.array(mediaSchema).max(10),
    })
    .optional(),
  error: z.object({ code: z.string().max(80), message: z.string().max(500), retryable: z.boolean() }).optional(),
});

const ORDER: JobStatus[] = ["researching", "scripting", "voiceover", "rendering"];

export type CallbackOutcome = { httpStatus: number; body: Record<string, unknown> };

export async function handleN8nCallback(raw: string, headers: Headers): Promise<CallbackOutcome> {
  const secret = env().N8N_SHARED_SECRET;
  if (!secret) return { httpStatus: 503, body: { error: "n8n nicht konfiguriert" } };
  const ts = headers.get("x-quest-timestamp") ?? "";
  const sig = headers.get("x-quest-signature") ?? "";
  if (!verifySignature(secret, ts, raw, sig)) return { httpStatus: 401, body: { error: "Signatur ungültig" } };

  let parsed: z.infer<typeof n8nCallbackSchema>;
  try {
    parsed = n8nCallbackSchema.parse(JSON.parse(raw));
  } catch {
    return { httpStatus: 400, body: { error: "Ungültige Nutzlast" } };
  }

  let eventRowId: string;
  try {
    const ev = await prisma.webhookEvent.create({
      data: { provider: "n8n", eventId: parsed.eventId, eventType: parsed.type, payload: JSON.parse(raw) as Prisma.InputJsonValue },
    });
    eventRowId = ev.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { httpStatus: 200, body: { duplicate: true } };
    throw e;
  }

  const finish = async (status: "processed" | "ignored" | "failed", note?: string) => {
    await prisma.webhookEvent.update({ where: { id: eventRowId }, data: { status, error: note, processedAt: new Date() } });
    return { httpStatus: 200, body: { status, note } };
  };

  const job = await prisma.productionJob.findUnique({ where: { id: parsed.jobId } });
  if (!job) return finish("ignored", "Auftrag unbekannt");
  if (job.externalRunId !== parsed.runId) return finish("ignored", "Veralteter Lauf");
  if (!job.awaitingExternal) return finish("ignored", "Auftrag erwartet keine Rückmeldung (verspätet oder abgebrochen)");
  if (parsed.seq <= job.lastExternalSeq) return finish("ignored", "Verspätete oder doppelte Meldung");

  try {
    if (parsed.type === "status" && parsed.status) {
      const from = ORDER.indexOf(job.status);
      const to = ORDER.indexOf(parsed.status);
      if (to <= from) {
        await prisma.productionJob.update({ where: { id: job.id }, data: { lastExternalSeq: parsed.seq } });
        return finish("ignored", "Kein Fortschritt");
      }
      await transitionJob(prisma, job, parsed.status, `n8n meldet: ${parsed.status}.`, { lastExternalSeq: parsed.seq });
      return finish("processed");
    }
    if (parsed.type === "result" && parsed.result) {
      const r = parsed.result;
      const wd = (job.workingData ?? {}) as Record<string, unknown>;
      await prisma.$transaction(async (tx) => {
        const current = { id: job.id, status: job.status, organizationId: job.organizationId };
        let j = current;
        // Direkt zur Prüfung – ggf. über „rendering“, damit der Automat gültig bleibt.
        if (j.status !== "rendering") {
          const path: JobStatus[] = ORDER.slice(ORDER.indexOf(j.status) + 1);
          for (const s of path) j = await transitionJob(tx, j, s, `n8n: ${s} abgeschlossen.`);
        }
        await transitionJob(tx, j, "quality_check", "Ergebnis von n8n empfangen – Medien werden kontrolliert übernommen.", {
          lastExternalSeq: parsed.seq,
          awaitingExternal: false,
          nextRunAt: new Date(),
          topic: r.topic,
          workingData: {
            ...wd,
            topic: r.topic,
            title: r.title,
            description: r.description,
            script: r.script,
            tags: r.tags,
            thumbnailText: r.thumbnailText,
            sources: r.sources,
            pendingMedia: r.media,
            generation: job.revisionCount + 1,
          } as Prisma.InputJsonValue,
        });
      });
      return finish("processed");
    }
    if (parsed.type === "error" && parsed.error) {
      await prisma.productionJob.update({ where: { id: job.id }, data: { lastExternalSeq: parsed.seq } });
      await applyFailure(prisma, job, "queued", { ...parsed.error, message: `n8n: ${parsed.error.message}`, provider: "n8n" });
      return finish("processed");
    }
    return finish("ignored", "Unvollständige Meldung");
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: eventRowId }, data: { status: "failed", error: (e as Error).message } });
    return { httpStatus: 200, body: { status: "failed" } };
  }
}

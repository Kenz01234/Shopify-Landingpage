import { hashPassword } from "better-auth/crypto";
import type { ContentFormat, JobStatus, Prisma, PlanKey, ReviewMode } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { addMonthsUtc, nextFreeOccurrences, occurrencesBetween } from "@/lib/time";
import { reserveQuota, consumeQuota } from "@/lib/quota";
import { buildSnapshot } from "@/lib/jobs/service";
import { demoResearch, demoScript } from "@/lib/demo/content";
import { runAutoCheck } from "@/lib/autocheck";
import { fixtures } from "@/providers/demo/fixtures";
import { findDemoVoice } from "@/lib/voices";
import { parseYouTubeChannel } from "@/lib/youtube-url";
import type { ConfigSnapshot } from "@/providers/types";

/**
 * Idempotentes Demo-Seeding. Legt nur Demo-Konten an (isDemo = true) und nur im Demo-Modus.
 * `resetDemoData()` löscht ausschließlich Demo-Organisationen/-Konten und baut sie neu auf.
 */

export const DEMO_ACCOUNTS = {
  kunde: { email: "kunde@demo.questagent.local", name: "Demo-Kundin" },
  zweiter: { email: "zweiter@demo.questagent.local", name: "Zweiter Demo-Kunde" },
  admin: { email: "admin@demo.questagent.local", name: "Demo-Admin" },
} as const;

function demoPassword() {
  const pw = process.env.DEMO_PASSWORD;
  if (!pw || pw.length < 10) throw new Error("DEMO_PASSWORD fehlt oder ist kürzer als 10 Zeichen.");
  return pw;
}

async function createUser(email: string, name: string, role: "customer" | "admin") {
  const id = crypto.randomUUID().replace(/-/g, "");
  const user = await prisma.user.create({
    data: { id, email, name, emailVerified: true, platformRole: role, isDemo: true },
  });
  await prisma.account.create({
    data: { id: crypto.randomUUID().replace(/-/g, ""), accountId: user.id, providerId: "credential", userId: user.id, password: await hashPassword(demoPassword()) },
  });
  return user;
}

async function createOrg(userId: string, name: string) {
  const org = await prisma.organization.create({ data: { name, isDemo: true } });
  await prisma.membership.create({ data: { organizationId: org.id, userId, role: "owner" } });
  return org;
}

type SystemSpec = {
  name: string;
  niche: string;
  topics: string[];
  audience: string;
  tone: string;
  style: string;
  voiceKey: string;
  longformPerPeriod: number;
  longformMinutes: number;
  shortsPerPeriod: number;
  shortSeconds: number;
  reviewMode: ReviewMode;
  refs: string[];
  slots: { format: ContentFormat; weekday: number; localTime: string }[];
};

async function createSystem(orgId: string, s: SystemSpec) {
  const system = await prisma.channelSystem.create({
    data: {
      organizationId: orgId,
      name: s.name,
      niche: s.niche,
      topics: s.topics,
      audience: s.audience,
      language: "de",
      tone: s.tone,
      style: s.style,
      voiceKey: s.voiceKey,
      voiceLabel: findDemoVoice(s.voiceKey)?.label ?? s.voiceKey,
      longformEnabled: s.longformPerPeriod > 0,
      shortsEnabled: s.shortsPerPeriod > 0,
      longformPerPeriod: s.longformPerPeriod,
      longformMinutes: s.longformMinutes,
      shortsPerPeriod: s.shortsPerPeriod,
      shortSeconds: s.shortSeconds,
      timezone: "Europe/Berlin",
      reviewMode: s.reviewMode,
      // Erst nach dem Seeden aktivieren: sonst belegt ein parallel laufender Scheduler dieselben Slots
      status: "paused",
      activatedAt: new Date(Date.now() - 20 * 86400000),
    },
  });
  await prisma.referenceChannel.createMany({
    data: s.refs.map((r) => {
      const p = parseYouTubeChannel(r);
      if (!p.ok) throw new Error(p.error);
      return { organizationId: orgId, systemId: system.id, input: r, url: p.value.url, kind: p.value.kind, identifier: p.value.identifier };
    }),
  });
  await prisma.scheduleSlot.createMany({ data: s.slots.map((sl) => ({ organizationId: orgId, systemId: system.id, ...sl })) });
  return prisma.channelSystem.findUniqueOrThrow({ where: { id: system.id }, include: { referenceChannels: true, slots: true } });
}

async function createSubscription(orgId: string, plan: PlanKey, startedDaysAgo: number) {
  const start = new Date(Date.now() - startedDaysAgo * 86400000);
  return prisma.subscription.create({
    data: { organizationId: orgId, plan, status: "active", provider: "demo", currentPeriodStart: start, currentPeriodEnd: addMonthsUtc(start, 1) },
  });
}

type JobSpec = {
  format: ContentFormat;
  status: JobStatus;
  slotAt: Date | null;
  scenario?: string;
  revision?: number;
  events: string[];
  publish?: { at: Date; status: "scheduled" | "simulated" };
  failure?: { step: JobStatus; code: string; message: string };
  stage?: "topic" | "final";
};

async function seedJob(system: Awaited<ReturnType<typeof createSystem>>, sub: Awaited<ReturnType<typeof createSubscription>>, spec: JobSpec, userId: string) {
  const snapshot = buildSnapshot(system) as ConfigSnapshot;
  const key = spec.slotAt ? `slot:${system.id}:${spec.format}:${spec.slotAt.toISOString()}` : `seed:${crypto.randomUUID()}`;
  const job = await prisma.productionJob.create({
    data: {
      organizationId: system.organizationId,
      systemId: system.id,
      format: spec.format,
      status: "queued",
      origin: spec.slotAt ? "schedule" : "manual",
      demoScenario: spec.scenario ?? "success",
      configVersion: system.configVersion,
      configSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      targetSlotAt: spec.slotAt,
      idempotencyKey: key,
      createdAt: new Date(Date.now() - 3 * 86400000),
    },
  });
  await prisma.$transaction((tx) => reserveQuota(tx, { orgId: system.organizationId, jobId: job.id, format: spec.format, sub }));

  const research = demoResearch(snapshot, job.id, spec.revision ?? 0, spec.format);
  const script = demoScript(snapshot, job.id, spec.revision ?? 0, spec.format, research.topic);
  const wd: Record<string, unknown> = { topic: research.topic, proposals: research.proposals, researchSummary: research.summary, sources: research.sources, scene: research.scene };

  let currentVersionId: string | null = null;
  const produced = ["awaiting_approval", "approved", "scheduled", "published"].includes(spec.status);
  if (produced) {
    const generation = 1;
    const kind = spec.format === "short" ? "short" : "video";
    const fx = fixtures().find((f) => f.kind === kind && f.scene === research.scene) ?? fixtures().find((f) => f.kind === kind);
    const voice = fixtures().find((f) => f.kind === "audio" && f.voice === system.voiceKey) ?? fixtures().find((f) => f.kind === "audio");
    const assets = [];
    if (fx) {
      assets.push(
        await prisma.asset.create({
          data: {
            organizationId: system.organizationId,
            jobId: job.id,
            generation,
            kind,
            storageKey: `fixtures/${fx.file}`,
            fileName: `${kind}-demo-${research.scene}.mp4`,
            mimeType: fx.mimeType,
            sizeBytes: fx.sizeBytes,
            durationSec: fx.durationSec,
            width: fx.width,
            height: fx.height,
            origin: "demo_fixture",
            rightsStatus: "demo_fixture",
            sourceLabel: "Quest-Agent-Demomaterial (lokal erzeugt)",
            license: fx.license,
            editNote: "Demo-Ausschnitt statt vollständiger Produktion",
          },
        }),
      );
    }
    if (voice) {
      await prisma.asset.create({
        data: {
          organizationId: system.organizationId,
          jobId: job.id,
          generation,
          kind: "audio",
          storageKey: `fixtures/${voice.file}`,
          fileName: `voiceover-demo-${system.voiceKey}.mp3`,
          mimeType: voice.mimeType,
          sizeBytes: voice.sizeBytes,
          durationSec: voice.durationSec,
          origin: "demo_fixture",
          rightsStatus: "public_domain",
          sourceLabel: "Lokale Beispielstimme (Piper, CC0-Datensatz) – spricht einen Beispieltext, nicht dieses Skript",
          license: voice.license,
        },
      });
    }
    const check = runAutoCheck({
      ...script,
      format: spec.format,
      targetSeconds: spec.format === "short" ? snapshot.shortSeconds : snapshot.longformMinutes * 60,
      sources: research.sources,
      media: assets.map((a) => ({ kind: a.kind, durationSec: a.durationSec })),
      isDemo: true,
      stage: "final",
    });
    const version = await prisma.contentVersion.create({
      data: {
        organizationId: system.organizationId,
        jobId: job.id,
        number: 1,
        stage: "final",
        title: script.title,
        description: script.description,
        script: script.script,
        thumbnailText: script.thumbnailText,
        tags: script.tags,
        sources: research.sources as unknown as Prisma.InputJsonValue,
        autoCheck: check as unknown as Prisma.InputJsonValue,
        createdByType: "system",
        mediaGeneration: generation,
        durationSec: fx ? Math.round(fx.durationSec) : null,
      },
    });
    await prisma.asset.updateMany({ where: { jobId: job.id }, data: { versionId: version.id } });
    currentVersionId = version.id;
    Object.assign(wd, { script: script.script, title: script.title, description: script.description, tags: script.tags, thumbnailText: script.thumbnailText, generation });
    await prisma.$transaction((tx) => consumeQuota(tx, job.id));

    if (spec.publish) {
      const approval = await prisma.approval.create({
        data: { organizationId: system.organizationId, jobId: job.id, versionId: version.id, userId, stage: "final", decision: "approved", scheduledFor: spec.publish.at },
      });
      const active = spec.publish.status === "scheduled";
      await prisma.publication.create({
        data: {
          organizationId: system.organizationId,
          jobId: job.id,
          systemId: system.id,
          versionId: version.id,
          approvalId: approval.id,
          format: spec.format,
          scheduledAt: spec.publish.at,
          status: spec.publish.status,
          mode: "simulated",
          slotKey: active ? `${system.id}:${spec.format}:${spec.publish.at.toISOString()}` : null,
          activeJobKey: active ? job.id : null,
          idempotencyKey: `pub:${job.id}:${approval.id}`,
          providerVideoId: active ? null : `demo-${job.id.slice(-10)}`,
          publishedAt: active ? null : spec.publish.at,
          attempt: active ? 0 : 1,
        },
      });
    }
  }
  if (spec.stage === "topic") {
    const version = await prisma.contentVersion.create({
      data: {
        organizationId: system.organizationId,
        jobId: job.id,
        number: 1,
        stage: "topic",
        title: research.topic,
        description: `${research.summary}\n\nWeitere Vorschläge: ${research.proposals.filter((p) => p !== research.topic).join(" · ")}`,
        script: "Das Skript entsteht nach deiner Bestätigung des Themas.",
        thumbnailText: "",
        tags: [],
        sources: research.sources as unknown as Prisma.InputJsonValue,
        autoCheck: runAutoCheck({ title: research.topic, description: research.summary, tags: [], script: "", thumbnailText: "", format: spec.format, targetSeconds: 600, sources: research.sources, media: [], isDemo: true, stage: "topic" }) as unknown as Prisma.InputJsonValue,
        createdByType: "system",
      },
    });
    currentVersionId = version.id;
  }

  await prisma.productionJob.update({
    where: { id: job.id },
    data: {
      status: spec.status,
      topic: research.topic,
      currentVersionId,
      workingData: wd as Prisma.InputJsonValue,
      nextRunAt: spec.status === "queued" ? new Date() : null,
      ...(spec.failure
        ? { failedStep: spec.failure.step, lastErrorCode: spec.failure.code, lastErrorMessage: spec.failure.message, attempt: 3 }
        : {}),
    },
  });
  let prev: JobStatus | null = null;
  const base = Date.now() - 2 * 86400000;
  for (const [i, message] of spec.events.entries()) {
    await prisma.jobEvent.create({
      data: {
        organizationId: system.organizationId,
        jobId: job.id,
        kind: "transition",
        fromStatus: prev,
        toStatus: i === spec.events.length - 1 ? spec.status : null,
        message,
        createdAt: new Date(base + i * 60_000),
      },
    });
    prev = null;
  }
  return job;
}

export async function seedDemoData() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Demo-Seed nur mit DEMO_MODE=true.");
  const existing = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS.kunde.email } });
  if (existing) return { skipped: true };

  const kunde = await createUser(DEMO_ACCOUNTS.kunde.email, DEMO_ACCOUNTS.kunde.name, "customer");
  const zweiter = await createUser(DEMO_ACCOUNTS.zweiter.email, DEMO_ACCOUNTS.zweiter.name, "customer");
  const admin = await createUser(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.name, "admin");

  // --- Kundin 1: Studio-Plan, zwei Systeme, Aufträge in allen wichtigen Zuständen
  const org1 = await createOrg(kunde.id, "Demo-Kanalstudio");
  const sub1 = await createSubscription(org1.id, "studio", 9);
  const kosmos = await createSystem(org1.id, {
    name: "Kosmos kompakt",
    niche: "Weltall & Wissen",
    topics: ["Exoplaneten", "Schwarze Löcher", "Raumfahrt"],
    audience: "Neugierige Erwachsene, die Wissen kompakt und spannend erzählt bekommen wollen",
    tone: "spannend",
    style: "doku",
    voiceKey: "demo-ruhig",
    longformPerPeriod: 12,
    longformMinutes: 10,
    shortsPerPeriod: 14,
    shortSeconds: 45,
    reviewMode: "final_only",
    refs: ["@demo-referenz-kosmos", "https://www.youtube.com/@demo-referenz-wissen"],
    slots: [
      { format: "longform", weekday: 1, localTime: "18:00" },
      { format: "longform", weekday: 3, localTime: "18:00" },
      { format: "longform", weekday: 5, localTime: "18:00" },
      { format: "short", weekday: 2, localTime: "12:00" },
      { format: "short", weekday: 4, localTime: "12:00" },
      { format: "short", weekday: 6, localTime: "12:00" },
    ],
  });
  const geschichte = await createSystem(org1.id, {
    name: "Vergessene Geschichte",
    niche: "Geschichte & Antike",
    topics: ["Antike Städte", "Handelswege", "Mittelalter"],
    audience: "Geschichtsinteressierte, die Hintergründe verstehen wollen",
    tone: "ruhig",
    style: "story",
    voiceKey: "demo-klar",
    longformPerPeriod: 6,
    longformMinutes: 8,
    shortsPerPeriod: 8,
    shortSeconds: 40,
    reviewMode: "topic_and_final",
    refs: ["@demo-referenz-geschichte"],
    slots: [
      { format: "longform", weekday: 4, localTime: "19:00" },
      { format: "short", weekday: 7, localTime: "11:00" },
    ],
  });

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86400000);
  const longSlots = occurrencesBetween(kosmos.slots.filter((s) => s.format === "longform"), "Europe/Berlin", now, horizon);
  const shortSlots = occurrencesBetween(kosmos.slots.filter((s) => s.format === "short"), "Europe/Berlin", now, horizon);
  const pastLong = nextFreeOccurrences(kosmos.slots, "Europe/Berlin", "longform", new Date(now.getTime() - 6 * 86400000), new Set(), 1)[0];

  await seedJob(kosmos, sub1, {
    format: "longform",
    status: "published",
    slotAt: pastLong.utc,
    events: ["Automatisch für den nächsten Slot angelegt.", "Demoproduktion abgeschlossen.", "Version 1 freigegeben.", "Demo-Veröffentlichung simuliert – nichts wurde zu YouTube hochgeladen."],
    publish: { at: pastLong.utc, status: "simulated" },
  }, kunde.id);
  await seedJob(kosmos, sub1, {
    format: "longform",
    status: "scheduled",
    slotAt: longSlots[1].utc,
    events: ["Automatisch für den nächsten Slot angelegt.", "Demoproduktion abgeschlossen.", "Version 1 freigegeben und eingeplant."],
    publish: { at: longSlots[1].utc, status: "scheduled" },
  }, kunde.id);
  await seedJob(kosmos, sub1, {
    format: "longform",
    status: "awaiting_approval",
    slotAt: longSlots[0].utc,
    events: ["Automatisch für den nächsten Slot angelegt.", "Demoproduktion abgeschlossen.", "Version 1 wartet auf deine Freigabe."],
  }, kunde.id);
  await seedJob(kosmos, sub1, {
    format: "short",
    status: "awaiting_approval",
    slotAt: shortSlots[0].utc,
    events: ["Automatisch für den nächsten Slot angelegt.", "Demoproduktion abgeschlossen.", "Version 1 wartet auf deine Freigabe."],
  }, kunde.id);
  await seedJob(kosmos, sub1, {
    format: "short",
    status: "failed",
    slotAt: shortSlots[1].utc,
    scenario: "permanent_failure",
    events: ["Automatisch für den nächsten Slot angelegt.", "Skript fertig.", "Der Stimmen-Dienst meldet: Zeichenkontingent erschöpft (Demo-Szenario) – nach 3 Versuchen angehalten."],
    failure: { step: "voiceover", code: "VOICE_QUOTA_EXCEEDED", message: "Der Stimmen-Dienst meldet: Zeichenkontingent erschöpft (Demo-Szenario)." },
  }, kunde.id);
  await seedJob(kosmos, sub1, {
    format: "longform",
    status: "queued",
    slotAt: longSlots[2].utc,
    events: ["Automatisch für den nächsten Slot angelegt – Kontingent reserviert."],
  }, kunde.id);

  const gLong = occurrencesBetween(geschichte.slots.filter((s) => s.format === "longform"), "Europe/Berlin", now, horizon);
  await seedJob(geschichte, sub1, {
    format: "longform",
    status: "awaiting_topic_approval",
    slotAt: gLong[0].utc,
    stage: "topic",
    events: ["Automatisch für den nächsten Slot angelegt.", "Themenvorschlag wartet auf deine Bestätigung."],
  }, kunde.id);

  await prisma.providerConnection.create({
    data: { organizationId: org1.id, provider: "youtube", mode: "demo", status: "demo", displayName: "Demo-Kanal (simuliert)", scopes: [] },
  });

  // --- Kunde 2: Starter-Plan, eigenes System (für Mandantentrennung)
  const org2 = await createOrg(zweiter.id, "Zweitkunde (Demo)");
  const sub2 = await createSubscription(org2.id, "starter", 3);
  const tiefsee = await createSystem(org2.id, {
    name: "Tiefsee-Wissen",
    niche: "Meer & Tiefsee",
    topics: ["Tiefseetiere", "Ozeanografie"],
    audience: "Naturinteressierte Familien",
    tone: "sachlich",
    style: "erklaer",
    voiceKey: "demo-klar",
    longformPerPeriod: 8,
    longformMinutes: 7,
    shortsPerPeriod: 12,
    shortSeconds: 30,
    reviewMode: "final_only",
    refs: ["@demo-referenz-meer", "@demo-referenz-natur"],
    slots: [
      { format: "longform", weekday: 2, localTime: "17:30" },
      { format: "short", weekday: 5, localTime: "08:00" },
    ],
  });
  const tLong = occurrencesBetween(tiefsee.slots.filter((s) => s.format === "longform"), "Europe/Berlin", now, horizon);
  await seedJob(tiefsee, sub2, {
    format: "longform",
    status: "awaiting_approval",
    slotAt: tLong[0].utc,
    events: ["Automatisch für den nächsten Slot angelegt.", "Version 1 wartet auf deine Freigabe."],
  }, zweiter.id);

  // --- Admin: eigene Organisation ohne Abo
  await createOrg(admin.id, "Quest-Agent-Betrieb (Demo)");

  await prisma.channelSystem.updateMany({ where: { id: { in: [kosmos.id, geschichte.id, tiefsee.id] } }, data: { status: "active" } });

  await prisma.auditEvent.create({ data: { actorType: "system", action: "demo.seeded", meta: { at: new Date().toISOString() } } });
  return { skipped: false };
}

export async function resetDemoData() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Zurücksetzen nur im Demo-Modus.");
  await prisma.organization.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { isDemo: true } });
  return seedDemoData();
}

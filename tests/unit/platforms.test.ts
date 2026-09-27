import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSystem, updateSystem } from "@/lib/systems";
import { createManualJob, retryJob } from "@/lib/jobs/service";
import { approve } from "@/lib/review";
import { freeSlotsForJob } from "@/lib/publishing";
import { captionFor } from "@/lib/platforms";
import { signMediaToken, verifyMediaToken } from "@/lib/media-links";
import { validateAgainstPlan } from "@/lib/validation/system";
import { claimDuePublication, publishOne, reconcileOne, recoverStalePublishing } from "@/worker/publisher";
import { makeCustomer, systemInput, runJobUntil } from "./helpers";

async function setClock(orgId: string, target: Date) {
  const minutes = Math.ceil((target.getTime() - Date.now()) / 60_000) + 1;
  await prisma.organization.update({ where: { id: orgId }, data: { demoClockOffsetMinutes: minutes } });
}

async function drain() {
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    const p = await claimDuePublication();
    if (!p) break;
    out.push(await publishOne(p));
  }
  return out;
}

/** Short mit allen drei Plattformen bis zur Freigabe produzieren und einplanen */
async function scheduledShort(demoScenario = "success") {
  const c = await makeCustomer();
  const system = await createSystem(c.ctx, systemInput({ shortPlatforms: ["youtube", "instagram", "tiktok"] }));
  const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "short", clientKey: crypto.randomUUID(), demoScenario });
  const ready = await runJobUntil(job.id, ["awaiting_approval"]);
  expect(ready.status).toBe("awaiting_approval");
  const slots = await freeSlotsForJob(c.ctx, job.id);
  await approve(c.ctx, job.id, { versionId: ready.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
  await setClock(c.org.id, new Date(new Date(slots.slots[0].at).getTime() + 60_000));
  const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id }, include: { targets: true } });
  return { ...c, system, job: ready, pub };
}

/** Alphabetisch nach Plattform (die Datenbank sortiert Enums in Deklarationsreihenfolge) */
const targets = async (publicationId: string) =>
  (await prisma.publicationTarget.findMany({ where: { publicationId } })).sort((a, b) => a.platform.localeCompare(b.platform));

describe("Mehrere Plattformen (YouTube, Instagram, TikTok)", () => {
  it("legt je Plattform ein Ziel an und veröffentlicht (simuliert) auf allen dreien", async () => {
    const { pub, job } = await scheduledShort();
    expect(pub.targets.map((t) => t.platform).sort()).toEqual(["instagram", "tiktok", "youtube"]);
    expect(pub.targets.every((t) => t.status === "pending" && t.mode === "simulated")).toBe(true);
    expect(await drain()).toEqual(["simulated"]);
    const ts = await targets(pub.id);
    expect(ts.map((t) => [t.platform, t.status, t.attempt])).toEqual([
      ["instagram", "simulated", 1],
      ["tiktok", "simulated", 1],
      ["youtube", "simulated", 1],
    ]);
    expect(ts.map((t) => t.providerPostId)).toEqual([expect.stringMatching(/^demo-ig-/), expect.stringMatching(/^demo-tt-/), expect.stringMatching(/^demo-yt-/)]);
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("published");
    const ev = await prisma.jobEvent.findFirstOrThrow({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } });
    expect(ev.message).toMatch(/YouTube.*Instagram.*TikTok/);
  });

  it("Longform geht nur zu YouTube – auch wenn für Shorts mehrere Plattformen gewählt sind", async () => {
    const c = await makeCustomer();
    const system = await createSystem(c.ctx, systemInput({ shortPlatforms: ["instagram", "tiktok"] }));
    const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID() });
    const ready = await runJobUntil(job.id, ["awaiting_approval"]);
    const slots = await freeSlotsForJob(c.ctx, job.id);
    await approve(c.ctx, job.id, { versionId: ready.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id }, include: { targets: true } });
    expect(pub.targets.map((t) => t.platform)).toEqual(["youtube"]);
  });

  it("Teilausfall: nur die fehlgeschlagene Plattform wird wiederholt, nichts doppelt hochgeladen", async () => {
    const { pub, job, ctx, org } = await scheduledShort("instagram_failure");
    expect(await drain()).toEqual(["failed"]);
    let ts = await targets(pub.id);
    expect(ts.map((t) => [t.platform, t.status])).toEqual([
      ["instagram", "failed"],
      ["tiktok", "simulated"],
      ["youtube", "simulated"],
    ]);
    const failedJob = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(failedJob.status).toBe("failed");
    expect(failedJob.failedStep).toBe("publishing");
    const done = Object.fromEntries(ts.map((t) => [t.platform, t.providerPostId]));

    await retryJob(ctx, job.id);
    const again = await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } });
    expect(again.status).toBe("scheduled");
    await setClock(org.id, new Date(again.scheduledAt.getTime() + 60_000));
    expect(await drain()).toEqual(["simulated"]);
    ts = await targets(pub.id);
    expect(ts.map((t) => [t.platform, t.status, t.attempt])).toEqual([
      ["instagram", "simulated", 2],
      ["tiktok", "simulated", 1],
      ["youtube", "simulated", 1],
    ]);
    expect(ts.find((t) => t.platform === "youtube")!.providerPostId).toBe(done.youtube);
    expect(ts.find((t) => t.platform === "tiktok")!.providerPostId).toBe(done.tiktok);
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("published");
  });

  it("Absturz mitten im Upload: laufende Plattform wird abgeglichen, offene danach fortgesetzt – nie doppelt", async () => {
    const { pub, job } = await scheduledShort();
    // Zustand nach Absturz: YouTube erledigt, Instagram mitten im Upload, TikTok noch offen
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "publishing", lockedUntil: new Date(Date.now() - 1000) } });
    await prisma.productionJob.update({ where: { id: job.id }, data: { status: "publishing" } });
    await prisma.publicationTarget.updateMany({ where: { publicationId: pub.id, platform: "youtube" }, data: { status: "simulated", attempt: 1, providerPostId: "demo-yt-vorher" } });
    await prisma.publicationTarget.updateMany({ where: { publicationId: pub.id, platform: "instagram" }, data: { status: "publishing", attempt: 1 } });

    expect(await recoverStalePublishing()).toBeGreaterThanOrEqual(1);
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe("reconciling");
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("reconciling");

    await reconcileOne();
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe("scheduled");
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("scheduled");

    expect(await drain()).toEqual(["simulated"]);
    const ts = await targets(pub.id);
    expect(ts.map((t) => [t.platform, t.status, t.attempt])).toEqual([
      ["instagram", "simulated", 1],
      ["tiktok", "simulated", 1],
      ["youtube", "simulated", 1],
    ]);
    expect(ts.find((t) => t.platform === "youtube")!.providerPostId).toBe("demo-yt-vorher");
  });

  it("hält eine echte Veröffentlichung zurück, wenn die Plattform nicht verbunden ist", async () => {
    const { pub, job } = await scheduledShort();
    await prisma.publicationTarget.updateMany({ where: { publicationId: pub.id, platform: "instagram" }, data: { mode: "live" } });
    const r = await drain();
    expect(r[0]).toBe("skip:not_connected");
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe("held");
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("held");
    expect((await targets(pub.id)).every((t) => t.status === "pending")).toBe(true);
  });

  it("laufende Aufträge behalten ihre Plattformen (Snapshot), Änderungen gelten für neue Aufträge", async () => {
    const c = await makeCustomer();
    const input = systemInput({ shortPlatforms: ["youtube", "tiktok"] });
    const system = await createSystem(c.ctx, input);
    const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "short", clientKey: crypto.randomUUID() });
    await updateSystem(c.ctx, system.id, { ...input, shortPlatforms: ["instagram"] });
    const ready = await runJobUntil(job.id, ["awaiting_approval"]);
    const slots = await freeSlotsForJob(c.ctx, job.id);
    await approve(c.ctx, job.id, { versionId: ready.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id }, include: { targets: true } });
    expect(pub.targets.map((t) => t.platform).sort()).toEqual(["tiktok", "youtube"]);
    expect((await prisma.channelSystem.findUniqueOrThrow({ where: { id: system.id } })).shortPlatforms).toEqual(["instagram"]);
  });

  it("verlangt mindestens eine Plattform, wenn Shorts aktiv sind", () => {
    const errors = validateAgainstPlan({ ...systemInput({ shortPlatforms: [] }), shortPlatforms: [] } as never, "studio", { longform: 0, shorts: 0 });
    expect(errors.shortPlatforms).toMatch(/mindestens eine Plattform/);
  });
});

describe("Beitragstext und Medienlinks", () => {
  it("leitet die Caption aus Titel und Tags ab und hält das Plattformlimit ein", () => {
    const c = captionFor({ caption: null, title: "Warum ist der Nachthimmel dunkel? #shorts", tags: ["Astronomie", "Olbers-Paradoxon", "Weltall"] }, "instagram");
    expect(c).toBe("Warum ist der Nachthimmel dunkel?\n\n#Astronomie #OlbersParadoxon #Weltall");
    expect(captionFor({ caption: "x".repeat(3000), title: "t", tags: [] }, "tiktok")).toHaveLength(2200);
    expect(captionFor({ caption: "  Eigener Text  ", title: "t", tags: ["a"] }, "instagram")).toBe("Eigener Text");
  });

  it("signierte Medienlinks sind fälschungssicher und laufen ab", () => {
    const now = Date.now();
    const token = signMediaToken("asset123", 60, now);
    expect(verifyMediaToken(token, now)).toEqual({ assetId: "asset123" });
    expect(verifyMediaToken(token, now + 61_000)).toBeNull();
    const [p, sig] = token.split(".");
    const forged = Buffer.from(Buffer.from(p, "base64url").toString().replace("asset123", "asset999")).toString("base64url");
    expect(verifyMediaToken(`${forged}.${sig}`, now)).toBeNull();
    expect(verifyMediaToken("kaputt", now)).toBeNull();
  });
});

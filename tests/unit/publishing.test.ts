import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSystem, pauseSystem, resumeSystem } from "@/lib/systems";
import { createManualJob } from "@/lib/jobs/service";
import { approve } from "@/lib/review";
import { freeSlotsForJob } from "@/lib/publishing";
import { claimDuePublication, publishOne, recoverStalePublishing } from "@/worker/publisher";
import { schedulerTick } from "@/worker/scheduler";
import { makeCustomer, systemInput, runJobUntil } from "./helpers";

async function setClock(orgId: string, target: Date) {
  const minutes = Math.ceil((target.getTime() - Date.now()) / 60_000) + 1;
  await prisma.organization.update({ where: { id: orgId }, data: { demoClockOffsetMinutes: minutes } });
}

async function drainPublications() {
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    const p = await claimDuePublication();
    if (!p) break;
    out.push(await publishOne(p));
  }
  return out;
}

async function setup() {
  const c = await makeCustomer();
  const system = await createSystem(c.ctx, systemInput());
  const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID() });
  const done = await runJobUntil(job.id, ["awaiting_approval"]);
  return { ...c, system, job: done };
}

describe("Veröffentlichung & Scheduler", () => {
  it("veröffentlicht ohne Freigabe nichts – auch wenn der Slot fällig ist", async () => {
    const { org, job } = await setup();
    await setClock(org.id, new Date(job.targetSlotAt!.getTime() + 5 * 60_000));
    await drainPublications();
    await schedulerTick();
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("awaiting_approval");
    expect(j.slotMissedAt).not.toBeNull();
    expect(j.suggestedSlotAt).not.toBeNull();
    expect(await prisma.publication.count({ where: { jobId: job.id } })).toBe(0);
  });

  it("simuliert die Veröffentlichung einer freigegebenen Version zum Termin", async () => {
    const { org, ctx, job } = await setup();
    const slots = await freeSlotsForJob(ctx, job.id);
    await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    expect(await drainPublications()).toEqual([]);
    await setClock(org.id, new Date(slots.slots[0].at));
    const r = await drainPublications();
    expect(r).toContain("simulated");
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    expect(pub.status).toBe("simulated");
    expect(pub.providerVideoId).toMatch(/^demo-/);
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("published");
  });

  it("hält geplante Veröffentlichungen bei pausiertem System zurück", async () => {
    const { org, ctx, job, system } = await setup();
    const slots = await freeSlotsForJob(ctx, job.id);
    await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    await pauseSystem(ctx, system.id);
    await setClock(org.id, new Date(slots.slots[0].at));
    expect(await drainPublications()).toEqual([]);
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    expect(pub.status).toBe("held");
    expect((await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("held");
    const r = await resumeSystem(ctx, system.id);
    expect(r.needsConfirmation).toBe(1);
  });

  it("pausierte Systeme erzeugen keine neuen Zyklen; aktive idempotent", async () => {
    const { org, ctx, system } = await setup();
    await prisma.organization.update({ where: { id: org.id }, data: { demoClockOffsetMinutes: 0 } });
    await schedulerTick();
    const n1 = await prisma.productionJob.count({ where: { systemId: system.id } });
    await schedulerTick();
    const n2 = await prisma.productionJob.count({ where: { systemId: system.id } });
    expect(n2).toBe(n1);
    await pauseSystem(ctx, system.id);
    await prisma.organization.update({ where: { id: org.id }, data: { demoClockOffsetMinutes: 14 * 24 * 60 } });
    await schedulerTick();
    expect(await prisma.productionJob.count({ where: { systemId: system.id, origin: "schedule" } })).toBe(n1 - 1);
  });

  it("lädt nach Worker-Absturz während des Uploads nicht erneut hoch, sondern gleicht ab", async () => {
    const { org, ctx, job } = await setup();
    const slots = await freeSlotsForJob(ctx, job.id);
    await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "publishing", lockedUntil: new Date(Date.now() - 1000) } });
    await prisma.productionJob.update({ where: { id: job.id }, data: { status: "publishing" } });
    expect(await recoverStalePublishing()).toBeGreaterThanOrEqual(1);
    expect((await prisma.publication.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe("reconciling");
    void org;
  });

  it("veröffentlicht nicht verspätet, wenn der Termin lange zurückliegt", async () => {
    const { org, ctx, job } = await setup();
    const slots = await freeSlotsForJob(ctx, job.id);
    await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    await setClock(org.id, new Date(new Date(slots.slots[0].at).getTime() + 3 * 3600_000));
    const r = await drainPublications();
    expect(r[0]).toMatch(/slot_passed/);
    expect((await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } })).status).toBe("held");
  });
});

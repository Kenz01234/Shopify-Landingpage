import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSystem } from "@/lib/systems";
import { createManualJob } from "@/lib/jobs/service";
import { approve, saveEdit, requestChanges } from "@/lib/review";
import { freeSlotsForJob, reschedulePublication } from "@/lib/publishing";
import { makeCustomer, systemInput, runJobUntil } from "./helpers";

async function producedJob() {
  const c = await makeCustomer();
  const system = await createSystem(c.ctx, systemInput());
  const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID() });
  const done = await runJobUntil(job.id, ["awaiting_approval"]);
  return { ...c, system, job: done };
}

describe("Freigabe & Versionen", () => {
  it("plant nach Freigabe ein – ohne sofortige Veröffentlichung", async () => {
    const { ctx, job } = await producedJob();
    const slots = await freeSlotsForJob(ctx, job.id);
    const r = await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    expect(r.stage).toBe("final");
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("scheduled");
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    expect(pub.status).toBe("scheduled");
    expect(pub.mode).toBe("simulated");
    expect(pub.versionId).toBe(job.currentVersionId);
  });

  it("lehnt Freigabe einer veralteten Version ab", async () => {
    const { ctx, job } = await producedJob();
    const v1 = job.currentVersionId!;
    const cur = await prisma.contentVersion.findUniqueOrThrow({ where: { id: v1 } });
    await saveEdit(ctx, job.id, { baseVersionId: v1, title: "Neuer Titel", description: cur.description, script: cur.script, thumbnailText: cur.thumbnailText, tags: cur.tags });
    const slots = await freeSlotsForJob(ctx, job.id);
    await expect(approve(ctx, job.id, { versionId: v1, stage: "final", scheduledAt: slots.slots[0].at })).rejects.toThrow(/neuere Inhaltsversion/);
  });

  it("entzieht einer Freigabe die Gültigkeit, wenn der Inhalt danach geändert wird", async () => {
    const { ctx, job } = await producedJob();
    const slots = await freeSlotsForJob(ctx, job.id);
    await approve(ctx, job.id, { versionId: job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    const cur = await prisma.contentVersion.findUniqueOrThrow({ where: { id: job.currentVersionId! } });
    const r = await saveEdit(ctx, job.id, { baseVersionId: cur.id, title: `${cur.title} (neu)`, description: cur.description, script: cur.script, thumbnailText: cur.thumbnailText, tags: cur.tags });
    expect(r.approvalRevoked).toBe(true);
    expect(r.number).toBe(cur.number + 1);
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("awaiting_approval");
    const approval = await prisma.approval.findFirstOrThrow({ where: { jobId: job.id, decision: "approved" } });
    expect(approval.revokedAt).not.toBeNull();
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    expect(pub.status).toBe("cancelled");
    expect(pub.slotKey).toBeNull();
  });

  it("Skriptänderung löst Neuproduktion aus, ohne neues Kontingent", async () => {
    const { ctx, job, org } = await producedJob();
    const cur = await prisma.contentVersion.findUniqueOrThrow({ where: { id: job.currentVersionId! } });
    const r = await saveEdit(ctx, job.id, { baseVersionId: cur.id, title: cur.title, description: cur.description, script: `${cur.script}\n\nNeuer Absatz.`, thumbnailText: cur.thumbnailText, tags: cur.tags });
    expect(r.requiresRerender).toBe(true);
    const done = await runJobUntil(job.id, ["awaiting_approval"]);
    const v = await prisma.contentVersion.findUniqueOrThrow({ where: { id: done.currentVersionId! } });
    expect(v.script).toContain("Neuer Absatz.");
    expect(v.requiresRerender).toBe(false);
    expect(await prisma.quotaEntry.count({ where: { organizationId: org.id, action: "consume" } })).toBe(1);
  });

  it("verhindert Kollisionen und Termine in der Vergangenheit", async () => {
    const a = await producedJob();
    const { job: second } = await createManualJob(a.ctx, { systemId: a.system.id, format: "longform", clientKey: crypto.randomUUID() });
    const j2 = await runJobUntil(second.id, ["awaiting_approval"]);
    const slots = await freeSlotsForJob(a.ctx, a.job.id);
    await approve(a.ctx, a.job.id, { versionId: a.job.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    await expect(approve(a.ctx, j2.id, { versionId: j2.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at })).rejects.toThrow(/bereits eine Veröffentlichung/);
    await expect(approve(a.ctx, j2.id, { versionId: j2.currentVersionId!, stage: "final", scheduledAt: new Date(Date.now() - 3600_000).toISOString() })).rejects.toThrow(/Vergangenheit/);
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: a.job.id } });
    await expect(reschedulePublication(a.ctx, pub.id, new Date(Date.now() - 60_000))).rejects.toThrow(/Vergangenheit/);
  });

  it("begrenzt Überarbeitungen", async () => {
    const { ctx, job } = await producedJob();
    for (let i = 0; i < 2; i++) {
      const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
      await requestChanges(ctx, job.id, { versionId: j.currentVersionId!, note: `Bitte kürzer (${i})` });
      await runJobUntil(job.id, ["awaiting_approval"]);
    }
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    await expect(requestChanges(ctx, job.id, { versionId: j.currentVersionId!, note: "Noch einmal" })).rejects.toThrow(/Maximal 2/);
  });
});

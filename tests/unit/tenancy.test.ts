import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSystem, pauseSystem, updateSystem } from "@/lib/systems";
import { cancelJob, createManualJob, retryJob, getJobForOrg } from "@/lib/jobs/service";
import { approve, saveEdit } from "@/lib/review";
import { freeSlotsForJob, reschedulePublication, calendarItems } from "@/lib/publishing";
import { makeCustomer, systemInput, runJobUntil } from "./helpers";

describe("Mandantentrennung", () => {
  it("fremde Kunden können Systeme, Aufträge und Termine weder lesen noch ändern", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    const sys = await createSystem(a.ctx, systemInput());
    const { job } = await createManualJob(a.ctx, { systemId: sys.id, format: "longform", clientKey: crypto.randomUUID() });
    const done = await runJobUntil(job.id, ["awaiting_approval"]);
    const slots = await freeSlotsForJob(a.ctx, job.id);

    await expect(getJobForOrg(prisma, b.ctx.orgId, job.id)).rejects.toThrow(/nicht gefunden/);
    await expect(freeSlotsForJob(b.ctx, job.id)).rejects.toThrow(/nicht gefunden/);
    await expect(approve(b.ctx, job.id, { versionId: done.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at })).rejects.toThrow(/nicht gefunden/);
    await expect(saveEdit(b.ctx, job.id, { baseVersionId: done.currentVersionId!, title: "x", description: "", script: "x", thumbnailText: "", tags: [] })).rejects.toThrow(/nicht gefunden/);
    await expect(cancelJob(b.ctx, job.id)).rejects.toThrow(/nicht gefunden/);
    await expect(retryJob(b.ctx, job.id)).rejects.toThrow(/nicht gefunden/);
    await expect(createManualJob(b.ctx, { systemId: sys.id, format: "longform", clientKey: crypto.randomUUID() })).rejects.toThrow(/nicht gefunden/);
    await expect(pauseSystem(b.ctx, sys.id)).rejects.toThrow(/nicht gefunden/);
    await expect(updateSystem(b.ctx, sys.id, systemInput())).rejects.toThrow(/nicht gefunden/);

    await approve(a.ctx, job.id, { versionId: done.currentVersionId!, stage: "final", scheduledAt: slots.slots[0].at });
    const pub = await prisma.publication.findFirstOrThrow({ where: { jobId: job.id } });
    await expect(reschedulePublication(b.ctx, pub.id, new Date(Date.now() + 7 * 86400000))).rejects.toThrow(/nicht gefunden/);
    const bItems = await calendarItems(b.ctx.orgId, new Date(Date.now() - 86400000), new Date(Date.now() + 30 * 86400000));
    expect(bItems.find((i) => i.jobId === job.id)).toBeUndefined();

    // Auch ein wiederverwendeter Idempotenzschlüssel eines anderen Kunden liefert keinen fremden Auftrag
    const key = crypto.randomUUID();
    const own = await createManualJob(a.ctx, { systemId: sys.id, format: "short", clientKey: key });
    const sysB = await createSystem(b.ctx, systemInput());
    const other = await createManualJob(b.ctx, { systemId: sysB.id, format: "short", clientKey: key });
    expect(other.job.id).not.toBe(own.job.id);
    expect(other.job.organizationId).toBe(b.ctx.orgId);
  });

  it("Systemeinstellungen beeinflussen keine anderen Systeme; laufende Aufträge behalten ihren Snapshot", async () => {
    const a = await makeCustomer();
    const s1 = await createSystem(a.ctx, systemInput({ name: "Eins", longformPerPeriod: 5, shortsPerPeriod: 5 }));
    const s2 = await createSystem(a.ctx, systemInput({ name: "Zwei", longformPerPeriod: 5, shortsPerPeriod: 5 }));
    const { job } = await createManualJob(a.ctx, { systemId: s1.id, format: "longform", clientKey: crypto.randomUUID() });
    await updateSystem(a.ctx, s1.id, systemInput({ name: "Eins neu", niche: "Geschichte & Antike", longformPerPeriod: 5, shortsPerPeriod: 5 }));
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect((j.configSnapshot as { niche: string }).niche).toBe("Weltall & Wissen");
    expect((await prisma.channelSystem.findUniqueOrThrow({ where: { id: s1.id } })).configVersion).toBe(2);
    expect((await prisma.channelSystem.findUniqueOrThrow({ where: { id: s2.id } })).name).toBe("Zwei");
  });

  it("lehnt Zuteilungen über dem Plan ab", async () => {
    const a = await makeCustomer({ plan: "starter" });
    await createSystem(a.ctx, systemInput({ longformPerPeriod: 10, shortsPerPeriod: 20 }));
    await expect(createSystem(a.ctx, systemInput({ longformPerPeriod: 6, shortsPerPeriod: 5 }))).rejects.toThrow(/markierten Angaben/);
    await expect(createSystem(a.ctx, systemInput({ longformPerPeriod: 2, longformMinutes: 9, shortsPerPeriod: 5 }))).rejects.toThrow(/markierten Angaben/);
  });
});

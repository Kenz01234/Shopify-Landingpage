import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { reserveQuota, consumeQuota, releaseQuota, ensureCounter } from "@/lib/quota";
import { createManualJob, retryJob } from "@/lib/jobs/service";
import { createSystem } from "@/lib/systems";
import { makeCustomer, systemInput, runJobUntil } from "./helpers";

async function jobShell(orgId: string, systemId: string, i: number) {
  return prisma.productionJob.create({
    data: { organizationId: orgId, systemId, format: "longform", status: "queued", origin: "manual", configVersion: 1, configSnapshot: {}, idempotencyKey: `t:${systemId}:${i}:${Math.random()}` },
  });
}

describe("Kontingente", () => {
  it("überschreitet das Limit auch bei 40 parallelen Reservierungen nicht", async () => {
    const { org, sub, ctx } = await makeCustomer({ plan: "starter" });
    const system = await createSystem(ctx, systemInput({ longformPerPeriod: 15, shortsPerPeriod: 10 }));
    const jobs = await Promise.all(Array.from({ length: 40 }, (_, i) => jobShell(org.id, system.id, i)));
    const results = await Promise.allSettled(jobs.map((j) => prisma.$transaction((tx) => reserveQuota(tx, { orgId: org.id, jobId: j.id, format: "longform", sub: sub! }))));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(15);
    const c = await ensureCounter(prisma, org.id, sub!, "longform");
    expect(c.reserved + c.consumed).toBe(15);
    expect(await prisma.quotaEntry.count({ where: { organizationId: org.id, action: "reserve" } })).toBe(15);
  });

  it("bucht Reservierung, Verbrauch und Freigabe genau einmal (idempotent)", async () => {
    const { org, sub, ctx } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const job = await jobShell(org.id, system.id, 1);
    await prisma.$transaction((tx) => reserveQuota(tx, { orgId: org.id, jobId: job.id, format: "longform", sub: sub! }));
    await prisma.$transaction((tx) => reserveQuota(tx, { orgId: org.id, jobId: job.id, format: "longform", sub: sub! }));
    expect(await prisma.$transaction((tx) => consumeQuota(tx, job.id))).toBe(true);
    expect(await prisma.$transaction((tx) => consumeQuota(tx, job.id))).toBe(false);
    expect(await prisma.$transaction((tx) => releaseQuota(tx, job.id))).toBe(false);
    const c = await ensureCounter(prisma, org.id, sub!, "longform");
    expect({ reserved: c.reserved, consumed: c.consumed }).toEqual({ reserved: 0, consumed: 1 });
  });

  it("gibt bei Abbruch vor Fertigstellung frei", async () => {
    const { org, sub, ctx } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const { job } = await createManualJob(ctx, { systemId: system.id, format: "short", clientKey: crypto.randomUUID() });
    let c = await ensureCounter(prisma, org.id, sub!, "short");
    expect(c.reserved).toBe(1);
    const { cancelJob } = await import("@/lib/jobs/service");
    await cancelJob(ctx, job.id);
    c = await ensureCounter(prisma, org.id, sub!, "short");
    expect(c.reserved).toBe(0);
  });

  it("legt bei doppeltem Absenden (gleicher Client-Schlüssel) keinen zweiten Auftrag an", async () => {
    const { ctx, org } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([
      createManualJob(ctx, { systemId: system.id, format: "longform", clientKey: key }),
      createManualJob(ctx, { systemId: system.id, format: "longform", clientKey: key }),
    ]);
    expect(a.job.id).toBe(b.job.id);
    expect(await prisma.productionJob.count({ where: { organizationId: org.id } })).toBe(1);
    expect(await prisma.quotaEntry.count({ where: { organizationId: org.id, action: "reserve" } })).toBe(1);
  });

  it("technische Wiederholungen und manueller Retry buchen nicht doppelt", async () => {
    const { ctx, org, sub } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const { job } = await createManualJob(ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID(), demoScenario: "transient_failure" });
    const done = await runJobUntil(job.id, ["awaiting_approval", "failed"]);
    expect(done.status).toBe("awaiting_approval");
    const events = await prisma.jobEvent.findMany({ where: { jobId: job.id } });
    expect(events.some((e) => e.toStatus === "retry_scheduled")).toBe(true);

    const { job: bad } = await createManualJob(ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID(), demoScenario: "permanent_failure" });
    const failed = await runJobUntil(bad.id, ["failed", "awaiting_approval"]);
    expect(failed.status).toBe("failed");
    expect(failed.failedStep).toBe("voiceover");
    await retryJob(ctx, bad.id);
    const ok = await runJobUntil(bad.id, ["awaiting_approval", "failed"]);
    expect(ok.status).toBe("awaiting_approval");
    const entries = await prisma.quotaEntry.findMany({ where: { organizationId: org.id } });
    expect(entries.filter((e) => e.action === "reserve")).toHaveLength(2);
    expect(entries.filter((e) => e.action === "consume")).toHaveLength(2);
    const c = await ensureCounter(prisma, org.id, sub!, "longform");
    expect(c.consumed).toBe(2);
  });
});

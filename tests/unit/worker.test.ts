import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSystem } from "@/lib/systems";
import { createManualJob } from "@/lib/jobs/service";
import { claimNextJob, processJob } from "@/worker/pipeline";
import { makeCustomer, systemInput } from "./helpers";

describe("Worker: Leases und Neustart", () => {
  it("übernimmt nach Absturz (abgelaufene Sperre) und bucht nichts doppelt", async () => {
    const { ctx, org } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const { job } = await createManualJob(ctx, { systemId: system.id, format: "short", clientKey: crypto.randomUUID() });
    // Andere Aufträge dieses Laufs nicht stören: nur diesen Auftrag „fällig“ machen
    await prisma.productionJob.updateMany({ where: { id: { not: job.id }, status: { in: ["queued", "researching", "scripting", "voiceover", "rendering", "quality_check", "changes_requested", "retry_scheduled"] } }, data: { nextRunAt: new Date(Date.now() + 3600_000) } });

    // Worker A hat den Auftrag gesperrt und ist abgestürzt (Sperre noch gültig)
    await prisma.productionJob.update({ where: { id: job.id }, data: { lockedBy: "worker-A", lockedUntil: new Date(Date.now() + 60_000), nextRunAt: null } });
    expect(await claimNextJob("worker-B")).toBeNull();

    // Sperre abgelaufen → Worker B übernimmt
    await prisma.productionJob.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const claimed = await claimNextJob("worker-B");
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.lockedBy).toBe("worker-B");

    // Bis zur Freigabe weiterlaufen lassen (jeweils neu beanspruchen)
    for (let i = 0; i < 30; i++) {
      const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
      if (j.status === "awaiting_approval") break;
      await prisma.productionJob.update({ where: { id: job.id }, data: { nextRunAt: null, lockedUntil: null, lockedBy: null } });
      const c = await claimNextJob("worker-B");
      if (c) await processJob(c, "worker-B");
    }
    const done = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe("awaiting_approval");
    const entries = await prisma.quotaEntry.findMany({ where: { organizationId: org.id } });
    expect(entries.map((e) => e.action).sort()).toEqual(["consume", "reserve"]);
  });

  it("gleichzeitige Claims liefern einen Auftrag nur einmal aus", async () => {
    const { ctx } = await makeCustomer();
    const system = await createSystem(ctx, systemInput());
    const { job } = await createManualJob(ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID() });
    await prisma.productionJob.updateMany({ where: { id: { not: job.id } }, data: { nextRunAt: new Date(Date.now() + 3600_000) } });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => claimNextJob(`w${i}`)));
    const got = results.filter((r) => r?.id === job.id);
    expect(got).toHaveLength(1);
  });
});

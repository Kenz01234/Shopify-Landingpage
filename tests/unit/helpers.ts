import { prisma } from "@/lib/db";
import { addMonthsUtc } from "@/lib/time";
import type { ContentFormat, PlanKey } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/jobs/service";

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Legt einen isolierten Testkunden an (User, Organisation, Abo). */
export async function makeCustomer(opts: { plan?: PlanKey; withSub?: boolean } = {}) {
  const id = uid();
  const user = await prisma.user.create({ data: { id: `u${id}`, name: `Test ${id}`, email: `t${id}@test.local` } });
  const org = await prisma.organization.create({ data: { name: `Org ${id}` } });
  await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "owner" } });
  let sub = null;
  if (opts.withSub !== false) {
    const start = new Date(Date.now() - 2 * 86400000);
    sub = await prisma.subscription.create({
      data: { organizationId: org.id, plan: opts.plan ?? "studio", status: "active", provider: "demo", currentPeriodStart: start, currentPeriodEnd: addMonthsUtc(start, 1) },
    });
  }
  const ctx: Ctx = { orgId: org.id, userId: user.id };
  return { user, org, sub, ctx };
}

export const systemInput = (over: Record<string, unknown> = {}) => ({
  name: "Testsystem",
  niche: "Weltall & Wissen",
  topics: ["Exoplaneten"],
  audience: "Neugierige Erwachsene",
  language: "de",
  referenceChannels: ["@referenz-eins", "https://www.youtube.com/@referenz-zwei"],
  tone: "spannend",
  style: "doku",
  voiceKey: "demo-ruhig",
  longformEnabled: true,
  shortsEnabled: true,
  longformPerPeriod: 8,
  longformMinutes: 7,
  shortsPerPeriod: 10,
  shortSeconds: 45,
  timezone: "Europe/Berlin",
  slots: [
    { format: "longform", weekday: 1, localTime: "18:00" },
    { format: "longform", weekday: 3, localTime: "18:00" },
    { format: "short", weekday: 2, localTime: "12:00" },
  ],
  reviewMode: "final_only",
  ...over,
});

/** Führt die Worker-Schritte eines Auftrags aus, bis ein Zielstatus erreicht ist. */
export async function runJobUntil(jobId: string, targets: string[], max = 40) {
  const { processJob } = await import("@/worker/pipeline");
  for (let i = 0; i < max; i++) {
    const job = await prisma.productionJob.findUniqueOrThrow({ where: { id: jobId } });
    if (targets.includes(job.status)) return job;
    await prisma.productionJob.update({ where: { id: jobId }, data: { nextRunAt: null, lockedBy: "test", lockedUntil: new Date(Date.now() + 60000) } });
    await processJob(job, "test");
  }
  return prisma.productionJob.findUniqueOrThrow({ where: { id: jobId } });
}

export type { ContentFormat };

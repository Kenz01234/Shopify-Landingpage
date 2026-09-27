import { api } from "@/lib/api";
import { prisma } from "@/lib/db";
import { REVIEW_STATUSES, PROCESSING_STATUSES } from "@/lib/jobs/state";

/** Leichtgewichtiger Status für Live-Aktualisierung (Badges, Worker-Anzeige). */
export const GET = api(async ({ ctx }) => {
  const [review, running, hb] = await Promise.all([
    prisma.productionJob.count({ where: { organizationId: ctx.orgId, status: { in: REVIEW_STATUSES } } }),
    prisma.productionJob.count({ where: { organizationId: ctx.orgId, status: { in: [...PROCESSING_STATUSES, "publishing"] } } }),
    prisma.workerHeartbeat.findUnique({ where: { id: "main" } }),
  ]);
  const workerAlive = !!hb && Date.now() - hb.lastBeatAt.getTime() < 60_000;
  return { review, running, workerAlive, workerLastBeat: hb?.lastBeatAt ?? null };
});

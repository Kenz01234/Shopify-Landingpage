import { prisma } from "@/lib/db";
import { REVIEW_STATUSES, PROCESSING_STATUSES } from "@/lib/jobs/state";
import { quotaSummary } from "@/lib/quota";
import { orgNow } from "@/lib/clock";
import { isEntitled, entitlementReason } from "@/lib/billing/subscription";

/** Lesende Abfragen für Server-Komponenten – immer auf die eigene Organisation beschränkt. */

export async function orgContext(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, include: { subscription: true } });
  const now = orgNow(org);
  return { org, sub: org.subscription, now, entitled: isEntitled(org.subscription, now), entitlementReason: entitlementReason(org.subscription, now) };
}

export async function overviewData(orgId: string) {
  const { org, sub, now, entitled, entitlementReason: reason } = await orgContext(orgId);
  const [systems, reviewJobs, running, upcoming, recent, quota, notices] = await Promise.all([
    prisma.channelSystem.findMany({
      where: { organizationId: orgId, status: { not: "archived" } },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { jobs: true } } },
    }),
    prisma.productionJob.findMany({
      where: { organizationId: orgId, status: { in: REVIEW_STATUSES } },
      include: { system: { select: { name: true, timezone: true } }, currentVersion: { select: { title: true, stage: true, number: true } } },
      orderBy: [{ targetSlotAt: "asc" }],
      take: 6,
    }),
    prisma.productionJob.findMany({
      where: { organizationId: orgId, status: { in: [...PROCESSING_STATUSES, "publishing", "reconciling"] } },
      include: { system: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.publication.findMany({
      where: { organizationId: orgId, status: { in: ["scheduled", "held"] } },
      include: { system: { select: { name: true, timezone: true } }, version: { select: { title: true } }, targets: { select: { platform: true, status: true, url: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.publication.findMany({
      where: { organizationId: orgId, status: { in: ["simulated", "published", "failed"] } },
      include: { system: { select: { name: true, timezone: true } }, version: { select: { title: true } }, targets: { select: { platform: true, status: true, url: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 3,
    }),
    quotaSummary(orgId, sub),
    prisma.auditEvent.findMany({ where: { organizationId: orgId, action: "notice" }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const reviewCount = await prisma.productionJob.count({ where: { organizationId: orgId, status: { in: REVIEW_STATUSES } } });
  const failedCount = await prisma.productionJob.count({ where: { organizationId: orgId, status: "failed" } });
  return { org, sub, now, entitled, reason, systems, reviewJobs, reviewCount, failedCount, running, upcoming, recent, quota, notices };
}

export async function workerStatus() {
  const hb = await prisma.workerHeartbeat.findUnique({ where: { id: "main" } });
  return { alive: !!hb && Date.now() - hb.lastBeatAt.getTime() < 60_000, lastBeatAt: hb?.lastBeatAt ?? null };
}

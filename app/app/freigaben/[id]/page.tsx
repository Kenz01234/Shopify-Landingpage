import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { DemoTag } from "@/components/ui/badge";
import { JobStatusBadge, FormatTag } from "@/components/app/bits";
import { ReviewEditor } from "@/components/app/review/review-editor";
import { freeSlotsForJob } from "@/lib/publishing";
import { isDemoMode } from "@/lib/env";
import { formatDateTimeDe } from "@/lib/time";
import type { AutoCheckResult } from "@/lib/autocheck";
import type { SourceNote } from "@/providers/types";
import { ASSUMPTIONS } from "@/lib/plans";

export const metadata = { title: "Prüfen & freigeben" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const job = await prisma.productionJob.findFirst({
    where: { id, organizationId: viewer.org.id },
    include: {
      system: true,
      currentVersion: true,
      versions: { orderBy: { number: "desc" }, select: { id: true, number: true, stage: true, createdByType: true, changeNote: true, createdAt: true, title: true } },
      approvals: { orderBy: { createdAt: "desc" }, include: { version: { select: { number: true } } } },
      publications: { where: { status: { in: ["scheduled", "held", "simulated", "published", "publishing", "reconciling"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!job || !job.currentVersion) notFound();
  const v = job.currentVersion;
  const assets = await prisma.asset.findMany({ where: { jobId: job.id, generation: v.mediaGeneration > 0 ? v.mediaGeneration : -1 } });
  const slots = await freeSlotsForJob({ orgId: viewer.org.id, userId: viewer.user.id }, job.id, 8);
  const tz = job.system.timezone;
  const pub = job.publications[0] ?? null;

  return (
    <>
      <PageHeader
        back={{ href: "/app/freigaben", label: "Freigaben" }}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            <FormatTag format={job.format} />
            <span className="text-sm text-ink-3">
              {job.system.name} · Version {v.number}
            </span>
            {isDemoMode() && <DemoTag>Demo-Ergebnis</DemoTag>}
          </span>
        }
        title={v.stage === "topic" ? "Thema bestätigen" : v.stage === "script" ? "Skript prüfen" : "Prüfen & freigeben"}
        description={job.targetSlotAt ? `Geplanter Slot: ${formatDateTimeDe(job.targetSlotAt, tz, "cccc, d. LLLL yyyy, HH:mm")} (${tz})` : undefined}
      />
      <ReviewEditor
        job={{
          id: job.id,
          status: job.status,
          format: job.format,
          revisionCount: job.revisionCount,
          maxRevisions: ASSUMPTIONS.maxRevisionsPerJob,
          slotMissedAt: job.slotMissedAt?.toISOString() ?? null,
          suggestedSlotAt: job.suggestedSlotAt?.toISOString() ?? null,
          timezone: tz,
          systemName: job.system.name,
          systemPaused: job.system.status === "paused",
        }}
        version={{
          id: v.id,
          number: v.number,
          stage: v.stage,
          title: v.title,
          description: v.description,
          script: v.script,
          thumbnailText: v.thumbnailText,
          tags: v.tags,
          requiresRerender: v.requiresRerender,
          sources: (v.sources as unknown as SourceNote[]) ?? [],
          autoCheck: (v.autoCheck as unknown as AutoCheckResult) ?? null,
          durationSec: v.durationSec,
        }}
        assets={assets.map((a) => ({
          id: a.id,
          kind: a.kind,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          durationSec: a.durationSec,
          width: a.width,
          height: a.height,
          rightsStatus: a.rightsStatus,
          sourceLabel: a.sourceLabel,
          license: a.license,
          editNote: a.editNote,
        }))}
        versions={job.versions.map((x) => ({ ...x, createdAt: x.createdAt.toISOString(), current: x.id === v.id }))}
        approvals={job.approvals.map((a) => ({
          id: a.id,
          decision: a.decision,
          stage: a.stage,
          versionNumber: a.version.number,
          comment: a.comment,
          createdAt: a.createdAt.toISOString(),
          revokedAt: a.revokedAt?.toISOString() ?? null,
          revokedReason: a.revokedReason,
          scheduledFor: a.scheduledFor?.toISOString() ?? null,
        }))}
        publication={pub ? { id: pub.id, status: pub.status, scheduledAt: pub.scheduledAt.toISOString(), mode: pub.mode, heldReason: pub.heldReason, versionId: pub.versionId } : null}
        slots={slots.slots}
        demo={isDemoMode()}
      />
    </>
  );
}

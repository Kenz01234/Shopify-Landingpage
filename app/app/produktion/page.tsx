import Link from "next/link";
import { Clapperboard } from "lucide-react";
import type { JobStatus } from "@/generated/prisma/enums";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { JobStatusBadge, FormatTag, PipelineBar } from "@/components/app/bits";
import { ListRefresher } from "@/components/app/list-refresher";
import { NewJobButton } from "@/components/app/new-job-button";
import { PROCESSING_STATUSES, REVIEW_STATUSES } from "@/lib/jobs/state";
import { formatDateTimeDe } from "@/lib/time";
import { isDemoMode } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata = { title: "Produktion" };

const FILTERS: { key: string; label: string; statuses?: JobStatus[] }[] = [
  { key: "alle", label: "Alle" },
  { key: "laeuft", label: "Läuft", statuses: [...PROCESSING_STATUSES, "publishing", "reconciling"] },
  { key: "freigabe", label: "Freigabe", statuses: REVIEW_STATUSES },
  { key: "geplant", label: "Geplant", statuses: ["approved", "scheduled", "held"] },
  { key: "online", label: "Veröffentlicht", statuses: ["published"] },
  { key: "failed", label: "Fehlgeschlagen", statuses: ["failed"] },
  { key: "beendet", label: "Abgebrochen/Verworfen", statuses: ["cancelled", "rejected"] },
];

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ filter?: string; system?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const filter = FILTERS.find((f) => f.key === sp.filter) ?? FILTERS[0];
  const systems = await prisma.channelSystem.findMany({ where: { organizationId: viewer.org.id }, orderBy: { createdAt: "asc" } });
  const systemId = systems.find((s) => s.id === sp.system)?.id;
  const jobs = await prisma.productionJob.findMany({
    where: { organizationId: viewer.org.id, ...(filter.statuses ? { status: { in: filter.statuses } } : {}), ...(systemId ? { systemId } : {}) },
    include: { system: { select: { name: true, timezone: true } }, currentVersion: { select: { title: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });
  const q = (f: string, s?: string) => `/app/produktion?filter=${f}${s ? `&system=${s}` : ""}`;

  return (
    <>
      <ListRefresher />
      <PageHeader
        title="Produktion"
        description="Jeder Auftrag durchläuft Recherche, Skript, KI-Stimme, Video und automatische Prüfung – danach entscheidest du. Status kommen live aus dem Backend."
        actions={<NewJobButton systems={systems.filter((s) => s.status === "active").map((s) => ({ id: s.id, name: s.name, longformEnabled: s.longformEnabled, shortsEnabled: s.shortsEnabled }))} demo={isDemoMode()} />}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={q(f.key, systemId)}
              aria-current={f.key === filter.key ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", f.key === filter.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {systems.length > 1 && (
          <nav aria-label="System" className="flex flex-wrap gap-1.5 sm:ml-auto">
            <Link href={q(filter.key)} className={cn("rounded-full px-3 py-1.5 text-sm", !systemId ? "font-semibold text-ink" : "text-ink-3 hover:text-ink")}>
              Alle Systeme
            </Link>
            {systems.map((s) => (
              <Link key={s.id} href={q(filter.key, s.id)} className={cn("rounded-full px-3 py-1.5 text-sm", systemId === s.id ? "font-semibold text-ink" : "text-ink-3 hover:text-ink")}>
                {s.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {jobs.length === 0 ? (
        <EmptyState icon={<Clapperboard className="size-6" />} title="Keine Aufträge in dieser Ansicht" text="Aufträge entstehen automatisch für deine Slots oder manuell über „Auftrag anlegen“." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={`/app/produktion/${j.id}`} className="grid gap-3 px-4 py-4 transition hover:bg-surface-2 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_10rem] md:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{j.currentVersion?.title ?? j.topic ?? "Thema wird recherchiert"}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    <FormatTag format={j.format} /> {j.system.name} · {j.targetSlotAt ? `Ziel ${formatDateTimeDe(j.targetSlotAt, j.system.timezone)}` : "ohne Slot"}
                    {j.status === "failed" && j.lastErrorMessage && <span className="text-coral-ink">· {j.lastErrorMessage}</span>}
                  </span>
                </span>
                <PipelineBar status={j.status} retryStep={j.retryStep ?? j.failedStep} compact />
                <span className="md:text-right">
                  <JobStatusBadge status={j.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

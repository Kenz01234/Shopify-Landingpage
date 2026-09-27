import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CircleDot } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, InlineAlert } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/badge";
import { JobStatusBadge, FormatTag, PipelineBar, PublicationBadge } from "@/components/app/bits";
import { PlatformChip } from "@/components/brand/platform-icon";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

const sortTargets = <T extends { platform: string }>(list: T[]) => [...list].sort((a, b) => PLATFORM_KEYS.indexOf(a.platform as PlatformKey) - PLATFORM_KEYS.indexOf(b.platform as PlatformKey));
import { JobLiveRefresher, JobControls } from "@/components/app/job-live";
import { CANCELLABLE_STATUSES, PROCESSING_STATUSES, REVIEW_STATUSES, STATUS_META } from "@/lib/jobs/state";
import { formatDateTimeDe } from "@/lib/time";
import { isDemoMode } from "@/lib/env";
import type { ConfigSnapshot } from "@/providers/types";

export const metadata = { title: "Auftrag" };

const QUOTA_DE: Record<string, string> = { none: "Nicht gebucht", reserved: "Reserviert", consumed: "Verbraucht", released: "Freigegeben" };
const SCENARIO_DE: Record<string, string> = { success: "Normaler Ablauf", transient_failure: "Technischer Fehler mit Wiederholung", permanent_failure: "Dauerhafter Providerfehler" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const job = await prisma.productionJob.findFirst({
    where: { id, organizationId: viewer.org.id },
    include: {
      system: true,
      currentVersion: true,
      events: { orderBy: { createdAt: "desc" }, take: 60 },
      publications: { orderBy: { createdAt: "desc" }, include: { targets: true } },
      versions: { orderBy: { number: "desc" }, select: { id: true, number: true, stage: true, createdByType: true, changeNote: true, createdAt: true } },
    },
  });
  if (!job) notFound();
  const snap = job.configSnapshot as unknown as ConfigSnapshot;
  const tz = job.system.timezone;
  const active = PROCESSING_STATUSES.includes(job.status) || job.status === "publishing" || job.status === "reconciling";
  const inReview = REVIEW_STATUSES.includes(job.status);
  const title = job.currentVersion?.title ?? job.topic ?? "Thema wird recherchiert";

  return (
    <>
      <PageHeader
        back={{ href: "/app/produktion", label: "Produktion" }}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            <FormatTag format={job.format} />
            {isDemoMode() && <DemoTag>Demoproduktion</DemoTag>}
          </span>
        }
        title={title}
        description={`${job.system.name} · ${job.origin === "schedule" ? "automatisch für einen Slot angelegt" : "manuell angelegt"} · Ziel ${job.targetSlotAt ? formatDateTimeDe(job.targetSlotAt, tz, "ccc, d. LLL yyyy, HH:mm") : "–"}`}
        actions={
          <>
            {inReview && (
              <ButtonLink href={`/app/freigaben/${job.id}`}>
                Jetzt prüfen <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            )}
            <JobControls jobId={job.id} canCancel={CANCELLABLE_STATUSES.includes(job.status)} canRetry={job.status === "failed"} />
          </>
        }
      />

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">{STATUS_META[job.status].hint}</p>
          <JobLiveRefresher jobId={job.id} status={job.status} updatedAt={job.updatedAt.toISOString()} active={active} />
        </div>
        <PipelineBar status={job.status} retryStep={job.retryStep ?? job.failedStep} />
        {job.status === "retry_scheduled" && (
          <InlineAlert tone="warn" className="mt-5" title={`Technischer Fehler – automatischer Versuch ${job.attempt + 1} von ${job.maxAttempts}`}>
            {job.lastErrorMessage} {job.nextRunAt && <>Nächster Versuch um {formatDateTimeDe(job.nextRunAt, tz, "HH:mm:ss")} Uhr.</>} Es wird kein zusätzliches Kontingent gebucht.
          </InlineAlert>
        )}
        {job.status === "failed" && (
          <InlineAlert tone="error" className="mt-5" title={job.failedStep === "publishing" ? "Veröffentlichung unvollständig" : "Produktion angehalten"}>
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
              <span>
                {job.lastErrorMessage ?? "Unbekannter Fehler."}{" "}
                {job.failedStep === "publishing" ? (
                  <>„Erneut versuchen“ veröffentlicht nur auf den fehlgeschlagenen Plattformen – bereits veröffentlichte werden nicht erneut hochgeladen.</>
                ) : (
                  <>
                    {job.failedStep && <>Betroffener Schritt: {STATUS_META[job.failedStep].label}.</>} „Erneut versuchen“ setzt an diesem Schritt fort und bucht nichts doppelt.
                  </>
                )}
              </span>
            </span>
          </InlineAlert>
        )}
        {job.slotMissedAt && (
          <InlineAlert tone="warn" className="mt-5" title="Termin ohne Freigabe verstrichen">
            Es wurde nichts veröffentlicht.{" "}
            {job.suggestedSlotAt ? <>Vorschlag für einen neuen Termin: {formatDateTimeDe(job.suggestedSlotAt, tz, "ccc, d. LLL, HH:mm")} – du bestätigst ihn bei der Freigabe.</> : "Bitte bei der Freigabe einen neuen Termin wählen."}
          </InlineAlert>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em]">Verlauf</h2>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {job.events.map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[1.62rem] top-1 grid size-3 place-items-center rounded-full ring-4 ring-surface ${e.kind === "warning" ? "bg-warn" : e.toStatus === "failed" ? "bg-coral" : e.toStatus ? "bg-coral/70" : "bg-line-strong"}`} />
                <p className="text-sm text-ink">{e.message}</p>
                <p className="text-xs text-ink-3">
                  {formatDateTimeDe(e.createdAt, tz, "d. LLL, HH:mm:ss")}
                  {e.toStatus && <> · {STATUS_META[e.toStatus].label}</>}
                </p>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Details</h2>
            <dl className="space-y-2.5 text-sm">
              <Row label="Kontingent" value={QUOTA_DE[job.quotaState] ?? job.quotaState} />
              <Row label="Versuche" value={`${job.attempt} / ${job.maxAttempts}`} />
              <Row label="Überarbeitungen" value={String(job.revisionCount)} />
              <Row label="Konfiguration" value={`Snapshot v${job.configVersion}${job.system.configVersion !== job.configVersion ? ` (System ist inzwischen v${job.system.configVersion})` : ""}`} />
              <Row label="Nische · Stimme" value={`${snap.niche} · ${snap.voiceLabel}`} />
              {isDemoMode() && <Row label="Demo-Szenario" value={SCENARIO_DE[job.demoScenario] ?? job.demoScenario} />}
            </dl>
          </Card>
          {job.versions.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Inhaltsversionen</h2>
              <ul className="space-y-2 text-sm">
                {job.versions.map((v) => (
                  <li key={v.id} className="flex items-start gap-2">
                    <CircleDot className={`mt-0.5 size-4 shrink-0 ${v.id === job.currentVersionId ? "text-coral" : "text-ink-3"}`} aria-hidden />
                    <span>
                      Version {v.number} · {v.stage === "final" ? "Ergebnis" : v.stage === "topic" ? "Thema" : "Skript"} · {v.createdByType === "user" ? "von dir bearbeitet" : "von Quest"}
                      {v.changeNote && <span className="block text-xs text-ink-3">{v.changeNote}</span>}
                      {v.id === job.currentVersionId && <span className="block text-xs font-semibold text-coral-ink">aktuell</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {job.publications.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Veröffentlichung</h2>
              <ul className="space-y-2 text-sm">
                {job.publications.map((p) => (
                  <li key={p.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{formatDateTimeDe(p.scheduledAt, tz, "ccc, d. LLL, HH:mm")}</span>
                      <span className="flex items-center gap-1.5">
                        <PublicationBadge status={p.status} />
                        {p.mode === "simulated" && <DemoTag />}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sortTargets(p.targets).map((t) => (
                        <span key={t.id} title={t.lastError ?? undefined}>
                          <PlatformChip platform={t.platform as PlatformKey} format={job.format} status={t.status} url={t.url} />
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/app/kalender" className="mt-3 inline-block text-sm font-medium text-coral-ink hover:underline">
                Im Kalender öffnen
              </Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

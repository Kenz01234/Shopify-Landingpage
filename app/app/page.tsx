import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Clapperboard, AlertTriangle, Plus, Workflow, Sparkles } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { overviewData } from "@/lib/queries";
import { PageHeader, Card, EmptyState, Stat, Meter, InlineAlert } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { JobStatusBadge, FormatTag, PublicationBadge, PipelineBar, Thumb } from "@/components/app/bits";
import { Badge, DemoTag } from "@/components/ui/badge";
import { formatDateTimeDe } from "@/lib/time";
import { PLANS } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_DE } from "@/lib/billing/subscription";

export const metadata = { title: "Übersicht" };

const SYSTEM_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  active: { label: "Aktiv", tone: "ok" },
  paused: { label: "Pausiert", tone: "warn" },
  archived: { label: "Archiviert", tone: "muted" },
};

export default async function OverviewPage() {
  const viewer = await requireViewer();
  const d = await overviewData(viewer.org.id);
  const first = viewer.user.name.split(" ")[0];
  const nextPub = d.upcoming.find((p) => p.status === "scheduled");

  return (
    <>
      <PageHeader
        eyebrow={<span className="eyebrow">{formatDateTimeDe(d.now, "Europe/Berlin", "cccc, d. LLLL")}</span>}
        title={`Hallo ${first} – dein Loop auf einen Blick`}
        description="Hier siehst du, was auf deine Freigabe wartet, was gerade produziert wird und wann die nächsten Inhalte eingeplant sind."
        actions={
          <ButtonLink href="/app/systeme/neu">
            <Plus className="size-4" aria-hidden /> Neues System erstellen
          </ButtonLink>
        }
      />

      {!d.sub && (
        <InlineAlert tone="info" title="Wähle zuerst einen Plan" className="mb-6">
          Ohne aktiven Plan kann Quest nichts produzieren. Im Demo-Modus wird dabei nichts abgebucht.{" "}
          <Link href="/app/abo" className="font-semibold text-coral-ink underline underline-offset-2">
            Zum Plan →
          </Link>
        </InlineAlert>
      )}
      {d.sub && !d.entitled && (
        <InlineAlert tone="warn" title="Produktion angehalten" className="mb-6">
          {d.reason}{" "}
          <Link href="/app/abo" className="font-semibold text-coral-ink underline underline-offset-2">
            Abo prüfen →
          </Link>
        </InlineAlert>
      )}
      {d.notices.map((n) => (
        <InlineAlert key={n.id} tone="warn" className="mb-3">
          {String((n.meta as { message?: string }).message ?? "Hinweis")}
        </InlineAlert>
      ))}

      {d.systems.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-6" />}
          title="Noch kein System angelegt"
          text="Lege fest, worum es in deinem Kanal gehen soll, welche Kanäle dich inspirieren und wann veröffentlicht wird. Der Assistent führt dich in sieben kurzen Schritten durch."
          action={
            <ButtonLink href="/app/systeme/neu" size="lg">
              Erstes System erstellen <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
            <Link href="/app/freigaben" className="group">
              <Stat
                label="Warten auf dich"
                value={d.reviewCount}
                sub={<span className="inline-flex items-center gap-1 text-coral-ink group-hover:underline">Freigaben öffnen <ArrowRight className="size-3" /></span>}
                className={d.reviewCount ? "border-coral/40 ring-1 ring-coral/15" : ""}
              />
            </Link>
            <Link href="/app/produktion">
              <Stat label="In Produktion" value={d.running.length} sub="Läuft automatisch" />
            </Link>
            <Link href="/app/kalender">
              <Stat
                label="Nächste Veröffentlichung"
                value={nextPub ? formatDateTimeDe(nextPub.scheduledAt, nextPub.system.timezone, "ccc HH:mm") : "–"}
                sub={nextPub ? nextPub.system.name : "Noch nichts eingeplant"}
              />
            </Link>
            <Link href="/app/produktion?filter=failed">
              <Stat label="Braucht Aufmerksamkeit" value={d.failedCount} sub={d.failedCount ? "Fehlgeschlagene Aufträge" : "Alles in Ordnung"} className={d.failedCount ? "border-warn/40" : ""} />
            </Link>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em]">
                  <BadgeCheck className="size-5 text-coral" aria-hidden /> Wartet auf deine Freigabe
                </h2>
                <Link href="/app/freigaben" className="text-sm font-medium text-coral-ink hover:underline">
                  Alle anzeigen
                </Link>
              </div>
              {d.reviewJobs.length === 0 ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">Nichts offen. Neue Ergebnisse erscheinen hier automatisch.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.reviewJobs.map((j) => (
                    <li key={j.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Thumb versionId={j.currentVersion?.stage === "final" ? j.currentVersionId : null} title={j.currentVersion?.title ?? ""} className="w-24 shrink-0 sm:w-32" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{j.currentVersion?.title ?? j.topic ?? "Ohne Titel"}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                          <FormatTag format={j.format} /> {j.system.name}
                          {j.targetSlotAt && <span>· Ziel {formatDateTimeDe(j.targetSlotAt, j.system.timezone)}</span>}
                          {j.slotMissedAt && <Badge tone="warn">Termin verstrichen</Badge>}
                        </p>
                      </div>
                      <ButtonLink href={`/app/freigaben/${j.id}`} size="sm" variant="secondary">
                        Prüfen
                      </ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em]">Plan & Kontingent</h2>
              {d.sub && d.quota ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {PLANS[d.sub.plan].name} <span className="font-normal text-ink-3">· {PLANS[d.sub.plan].priceEurMonthly} € / Monat</span>
                    </p>
                    <Badge tone={d.sub.status === "active" ? "ok" : "warn"}>{SUBSCRIPTION_STATUS_DE[d.sub.status]}</Badge>
                  </div>
                  <Meter label="Longform-Videos" used={d.quota.longform.consumed} reserved={d.quota.longform.reserved} limit={d.quota.longform.limit} />
                  <Meter label="Shorts" used={d.quota.short.consumed} reserved={d.quota.short.reserved} limit={d.quota.short.limit} />
                  <p className="text-xs text-ink-3">
                    Zeitraum {formatDateTimeDe(d.quota.periodStart, "Europe/Berlin", "d. LLL")} – {formatDateTimeDe(d.quota.periodEnd, "Europe/Berlin", "d. LLL yyyy")}.
                    Reserviert = in Produktion, verbraucht = fertig produziert.
                  </p>
                  <ButtonLink href="/app/abo" variant="secondary" size="sm">
                    Abo verwalten
                  </ButtonLink>
                </div>
              ) : (
                <div className="text-sm text-ink-3">
                  <p>Noch kein Plan aktiv.</p>
                  <ButtonLink href="/app/abo" size="sm" className="mt-3">
                    Plan wählen
                  </ButtonLink>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em]">
                <CalendarClock className="size-5 text-coral" aria-hidden /> Nächste Veröffentlichungen
              </h2>
              {d.upcoming.length === 0 ? (
                <p className="text-sm text-ink-3">Noch nichts eingeplant. Freigegebene Inhalte erscheinen hier mit Termin.</p>
              ) : (
                <ul className="space-y-2">
                  {d.upcoming.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-xs font-semibold uppercase text-ink-3">{formatDateTimeDe(p.scheduledAt, p.system.timezone, "ccc")}</p>
                        <p className="font-display text-lg font-bold leading-tight">{formatDateTimeDe(p.scheduledAt, p.system.timezone, "HH:mm")}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.version.title}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-3">
                          <FormatTag format={p.format} /> {p.system.name} · {formatDateTimeDe(p.scheduledAt, p.system.timezone, "d. LLL")}
                        </p>
                      </div>
                      <PublicationBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
              {d.recent.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">Zuletzt</p>
                  <ul className="space-y-1.5 text-sm">
                    {d.recent.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink-2">{p.version.title}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <PublicationBadge status={p.status} />
                          {p.mode === "simulated" && <DemoTag />}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em]">
                <Clapperboard className="size-5 text-coral" aria-hidden /> Läuft gerade
              </h2>
              {d.running.length === 0 ? (
                <p className="text-sm text-ink-3">Gerade läuft keine Produktion. Der Scheduler legt Aufträge automatisch für deine nächsten Slots an.</p>
              ) : (
                <ul className="space-y-3">
                  {d.running.map((j) => (
                    <li key={j.id}>
                      <Link href={`/app/produktion/${j.id}`} className="block rounded-2xl border border-line p-3 transition hover:border-line-strong">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{j.topic ?? "Thema wird recherchiert"}</p>
                          <JobStatusBadge status={j.status} />
                        </div>
                        <PipelineBar status={j.status} retryStep={j.retryStep} />
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                          <FormatTag format={j.format} /> {j.system.name}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Meine Systeme</h2>
              <Link href="/app/systeme" className="text-sm font-medium text-coral-ink hover:underline">
                Verwalten
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.systems.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/systeme/${s.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-lg font-semibold tracking-[-0.02em]">{s.name}</p>
                      <Badge tone={SYSTEM_STATUS[s.status].tone} dot>
                        {SYSTEM_STATUS[s.status].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-3">{s.niche}</p>
                    <p className="mt-4 text-sm text-ink-2">
                      {s.longformEnabled ? `${s.longformPerPeriod} Videos à ${s.longformMinutes} Min.` : "Keine Videos"} ·{" "}
                      {s.shortsEnabled ? `${s.shortsPerPeriod} Shorts` : "keine Shorts"}
                    </p>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/app/systeme/neu"
                  className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong text-sm font-medium text-ink-3 transition hover:border-coral/50 hover:text-coral-ink"
                >
                  <Sparkles className="size-5" aria-hidden /> Weiteres System erstellen
                </Link>
              </li>
            </ul>
          </section>
          {d.failedCount > 0 && (
            <p className="mt-6 flex items-center gap-2 text-sm text-warn">
              <AlertTriangle className="size-4" aria-hidden /> {d.failedCount} Auftrag{d.failedCount === 1 ? "" : "e"} fehlgeschlagen –{" "}
              <Link href="/app/produktion?filter=failed" className="font-semibold underline">
                ansehen und wiederholen
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}

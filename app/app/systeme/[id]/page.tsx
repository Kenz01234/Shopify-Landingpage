import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, AudioLines, Users, Gauge, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, InlineAlert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { SystemActions } from "@/components/app/system-actions";
import { JobStatusBadge, FormatTag, PipelineBar } from "@/components/app/bits";
import { previewSlots } from "@/lib/systems";
import { orgNow } from "@/lib/clock";
import { WEEKDAYS_LONG_DE, formatDateTimeDe } from "@/lib/time";
import { REVIEW_MODES, TONES, STYLES, LANGUAGES } from "@/lib/validation/system";
import { isDemoMode } from "@/lib/env";
import { ensureCounter, systemUsage } from "@/lib/quota";

export const metadata = { title: "System" };

const STATUS = { active: { label: "Aktiv", tone: "ok" }, paused: { label: "Pausiert", tone: "warn" }, archived: { label: "Archiviert", tone: "muted" } } as const;

export default async function SystemDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const { id } = await params;
  const { neu } = await searchParams;
  const viewer = await requireViewer();
  const system = await prisma.channelSystem.findFirst({
    where: { id, organizationId: viewer.org.id },
    include: {
      referenceChannels: { orderBy: { createdAt: "asc" } },
      slots: { orderBy: [{ format: "asc" }, { weekday: "asc" }, { localTime: "asc" }] },
      organization: { include: { subscription: true } },
      jobs: { orderBy: { createdAt: "desc" }, take: 12, include: { currentVersion: { select: { title: true } } } },
    },
  });
  if (!system) notFound();
  const now = orgNow(system.organization);
  const upcoming = system.status === "active" ? previewSlots(system.slots, system.timezone, now, 6) : [];
  const sub = system.organization.subscription;
  let usage: { longform: number; short: number } | null = null;
  if (sub) {
    const [cl, cs] = await Promise.all([ensureCounter(prisma, viewer.org.id, sub, "longform"), ensureCounter(prisma, viewer.org.id, sub, "short")]);
    usage = { longform: await systemUsage(prisma, system.id, cl.id, "longform"), short: await systemUsage(prisma, system.id, cs.id, "short") };
  }

  return (
    <>
      <PageHeader
        back={{ href: "/app/systeme", label: "Systeme" }}
        eyebrow={
          <Badge tone={STATUS[system.status].tone} dot>
            {STATUS[system.status].label}
          </Badge>
        }
        title={system.name}
        description={`${system.niche} · Konfiguration v${system.configVersion} · ${system.timezone}`}
        actions={
          <SystemActions
            systemId={system.id}
            status={system.status}
            name={system.name}
            longformEnabled={system.longformEnabled}
            shortsEnabled={system.shortsEnabled}
            demo={isDemoMode()}
          />
        }
      />
      {neu && (
        <InlineAlert tone="ok" title="Dein Loop ist aktiv" className="mb-6">
          Der Scheduler legt jetzt Aufträge für deine nächsten Slots an. Fertige Ergebnisse findest du in den{" "}
          <Link href="/app/freigaben" className="font-semibold underline">
            Freigaben
          </Link>
          . Nichts wird ohne deine Freigabe veröffentlicht.
        </InlineAlert>
      )}
      {system.status === "paused" && (
        <InlineAlert tone="warn" title="System pausiert" className="mb-6">
          Es entstehen keine neuen Zyklen. Bereits geplante Veröffentlichungen werden zurückgehalten, bis du fortsetzt.
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em]">Konfiguration</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Item icon={<Users className="size-4" />} label="Zielgruppe" value={system.audience} />
            <Item label="Sprache · Ton · Stil" value={`${LANGUAGES.find((l) => l.value === system.language)?.label} · ${TONES.find((t) => t.value === system.tone)?.label} · ${STYLES.find((s) => s.value === system.style)?.label}`} />
            <Item icon={<AudioLines className="size-4" />} label="KI-Stimme" value={`${system.voiceLabel}${isDemoMode() ? " (Demo)" : ""}`} />
            <Item icon={<ShieldCheck className="size-4" />} label="Freigabe" value={REVIEW_MODES.find((m) => m.value === system.reviewMode)?.label ?? ""} />
            <Item
              icon={<Gauge className="size-4" />}
              label="Mengen pro Zeitraum"
              value={
                <>
                  {system.longformEnabled ? `${system.longformPerPeriod} Videos à ${system.longformMinutes} Min.` : "Keine Videos"}
                  {usage && system.longformEnabled && <span className="text-ink-3"> ({usage.longform} belegt)</span>}
                  <br />
                  {system.shortsEnabled ? `${system.shortsPerPeriod} Shorts à ${system.shortSeconds} Sek.` : "Keine Shorts"}
                  {usage && system.shortsEnabled && <span className="text-ink-3"> ({usage.short} belegt)</span>}
                </>
              }
            />
            <Item
              label="Themen"
              value={system.topics.length ? system.topics.join(", ") : "–"}
            />
          </dl>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Referenzkanäle</h3>
          <ul className="flex flex-wrap gap-2">
            {system.referenceChannels.map((r) => (
              <li key={r.id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">
                {r.identifier}
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Uploadplan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["longform", "short"] as const).map((f) => {
              const list = system.slots.filter((s) => s.format === f);
              if (!list.length) return null;
              return (
                <div key={f} className="rounded-2xl border border-line p-3">
                  <FormatTag format={f} />
                  <ul className="mt-2 space-y-1 text-sm">
                    {list.map((s) => (
                      <li key={s.id}>
                        {WEEKDAYS_LONG_DE[s.weekday - 1]}, {s.localTime} Uhr
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em]">
            <CalendarDays className="size-5 text-coral" aria-hidden /> Nächste Slots
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-3">{system.status === "active" ? "Keine Slots in den nächsten drei Wochen." : "Pausiert – keine neuen Slots."}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.map((u) => (
                <li key={u.at + u.format} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                  <span>
                    {u.label}
                    {u.adjustmentText && <span className="block text-xs text-warn">{u.adjustmentText}</span>}
                  </span>
                  <FormatTag format={u.format} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Aufträge dieses Systems</h2>
          <Link href={`/app/produktion?system=${system.id}`} className="text-sm font-medium text-coral-ink hover:underline">
            Alle anzeigen
          </Link>
        </div>
        {system.jobs.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">
            Noch keine Aufträge. Der Scheduler legt sie automatisch für die nächsten Slots an – oder du startest einen manuell.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {system.jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/app/produktion/${j.id}`} className="grid gap-2 px-5 py-3.5 transition hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.currentVersion?.title ?? j.topic ?? "Thema wird recherchiert"}</span>
                    <span className="flex items-center gap-1.5 text-xs text-ink-3">
                      <FormatTag format={j.format} /> {j.targetSlotAt ? `Ziel ${formatDateTimeDe(j.targetSlotAt, system.timezone)}` : "ohne Slot"} · v{j.configVersion}
                    </span>
                  </span>
                  <PipelineBar status={j.status} retryStep={j.retryStep} compact />
                  <JobStatusBadge status={j.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Item({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}

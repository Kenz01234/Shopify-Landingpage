import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WEEKDAYS_DE } from "@/lib/time";
import { REVIEW_MODES } from "@/lib/validation/system";

export const metadata = { title: "Systeme" };

const STATUS = { active: { label: "Aktiv", tone: "ok" }, paused: { label: "Pausiert", tone: "warn" }, archived: { label: "Archiviert", tone: "muted" } } as const;

export default async function SystemsPage({ searchParams }: { searchParams: Promise<{ archiv?: string }> }) {
  const { archiv } = await searchParams;
  const viewer = await requireViewer();
  const systems = await prisma.channelSystem.findMany({
    where: { organizationId: viewer.org.id, status: archiv ? "archived" : { not: "archived" } },
    include: { slots: true, referenceChannels: true, _count: { select: { jobs: true } } },
    orderBy: { createdAt: "asc" },
  });
  const archivedCount = await prisma.channelSystem.count({ where: { organizationId: viewer.org.id, status: "archived" } });
  return (
    <>
      <PageHeader
        title={archiv ? "Archivierte Systeme" : "Systeme"}
        description="Jedes System ist ein eigener Loop mit Nische, Vorbildern, Stimme, Mengen und Uploadplan. Einstellungen beeinflussen keine anderen Systeme."
        actions={
          <ButtonLink href="/app/systeme/neu">
            <Plus className="size-4" aria-hidden /> Neues System
          </ButtonLink>
        }
      />
      {systems.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-6" />}
          title={archiv ? "Keine archivierten Systeme" : "Noch kein System"}
          text={archiv ? undefined : "Starte mit deinem ersten System – der Assistent führt dich durch alle Einstellungen."}
          action={!archiv ? <ButtonLink href="/app/systeme/neu">System erstellen</ButtonLink> : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {systems.map((s) => (
            <li key={s.id}>
              <Link href={`/app/systeme/${s.id}`} className="card block h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-semibold tracking-[-0.02em]">{s.name}</p>
                    <p className="text-sm text-ink-3">{s.niche}</p>
                  </div>
                  <Badge tone={STATUS[s.status].tone} dot>
                    {STATUS[s.status].label}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-3">Mengen</dt>
                    <dd className="font-medium">
                      {s.longformPerPeriod} Videos · {s.shortsPerPeriod} Shorts
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Vorbilder</dt>
                    <dd className="font-medium">{s.referenceChannels.length} Kanäle</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Videos</dt>
                    <dd className="font-medium">
                      {s.slots.filter((x) => x.format === "longform").map((x) => `${WEEKDAYS_DE[x.weekday - 1]} ${x.localTime}`).join(", ") || "–"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Shorts</dt>
                    <dd className="font-medium">
                      {s.slots.filter((x) => x.format === "short").map((x) => `${WEEKDAYS_DE[x.weekday - 1]} ${x.localTime}`).join(", ") || "–"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-ink-3">
                  {REVIEW_MODES.find((m) => m.value === s.reviewMode)?.label} · {s._count.jobs} Aufträge · Konfiguration v{s.configVersion}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {archivedCount > 0 && (
        <p className="mt-6 text-sm">
          <Link href={archiv ? "/app/systeme" : "/app/systeme?archiv=1"} className="font-medium text-coral-ink hover:underline">
            {archiv ? "← Aktive Systeme" : `Archivierte Systeme anzeigen (${archivedCount})`}
          </Link>
        </p>
      )}
    </>
  );
}

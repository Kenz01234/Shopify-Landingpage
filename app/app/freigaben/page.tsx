import Link from "next/link";
import { BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FormatTag, Thumb } from "@/components/app/bits";
import { ListRefresher } from "@/components/app/list-refresher";
import { formatDateTimeDe } from "@/lib/time";
import type { AutoCheckResult } from "@/lib/autocheck";

export const metadata = { title: "Freigaben" };

const GROUPS = [
  { status: "awaiting_approval" as const, title: "Ergebnis prüfen & freigeben", text: "Fertige Videos und Shorts – nichts geht ohne deine Freigabe online." },
  { status: "awaiting_topic_approval" as const, title: "Thema bestätigen", text: "Vor der Produktion: passt das vorgeschlagene Thema?" },
  { status: "awaiting_script_approval" as const, title: "Skript bestätigen", text: "Vor Vertonung und Schnitt: passt das Skript?" },
];

export default async function InboxPage() {
  const viewer = await requireViewer();
  const jobs = await prisma.productionJob.findMany({
    where: { organizationId: viewer.org.id, status: { in: GROUPS.map((g) => g.status) } },
    include: { system: { select: { name: true, timezone: true } }, currentVersion: true },
    orderBy: [{ targetSlotAt: "asc" }, { updatedAt: "asc" }],
  });
  return (
    <>
      <ListRefresher />
      <PageHeader
        title="Freigaben"
        description="Hier landet alles, was deine Entscheidung braucht. Die automatische Prüfung hilft dir – sie ersetzt aber nie deine Freigabe."
      />
      {jobs.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="size-6" />} title="Alles erledigt" text="Sobald Quest neue Ergebnisse fertig hat, erscheinen sie hier. Du bekommst den Stand auch in der Übersicht angezeigt." action={<ButtonLink href="/app/produktion" variant="secondary">Zur Produktion</ButtonLink>} />
      ) : (
        <div className="space-y-10">
          {GROUPS.map((g) => {
            const list = jobs.filter((j) => j.status === g.status);
            if (!list.length) return null;
            return (
              <section key={g.status} aria-labelledby={`g-${g.status}`}>
                <h2 id={`g-${g.status}`} className="font-display text-xl font-semibold tracking-[-0.02em]">
                  {g.title} <span className="text-ink-3">({list.length})</span>
                </h2>
                <p className="mb-4 text-sm text-ink-3">{g.text}</p>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((j) => {
                    const check = (j.currentVersion?.autoCheck ?? null) as AutoCheckResult | null;
                    return (
                      <li key={j.id} className="card flex flex-col overflow-hidden">
                        <Link href={`/app/freigaben/${j.id}`} className="group flex flex-1 flex-col">
                          {g.status === "awaiting_approval" ? (
                            <Thumb versionId={j.currentVersionId} title={j.currentVersion?.title ?? ""} className="rounded-none border-0 border-b transition group-hover:opacity-95" />
                          ) : (
                            <div className="border-b border-line bg-surface-2 px-5 py-4 text-sm text-ink-3">{g.status === "awaiting_topic_approval" ? "Themenvorschlag" : "Skript-Entwurf"}</div>
                          )}
                          <div className="flex flex-1 flex-col p-4">
                            <p className="line-clamp-2 font-semibold group-hover:underline">{j.currentVersion?.title ?? j.topic}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                              <FormatTag format={j.format} /> {j.system.name} · Version {j.currentVersion?.number}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {check && (
                                <Badge tone={check.content.status === "pass" ? "ok" : check.content.status === "warn" ? "warn" : "error"}>
                                  <ShieldCheck className="size-3" /> Prüfung: {check.content.status === "pass" ? "ok" : check.content.status === "warn" ? "Hinweise" : "Probleme"}
                                </Badge>
                              )}
                              {check && g.status === "awaiting_approval" && (
                                <Badge tone={check.rights.status === "clear" ? "neutral" : "warn"}>
                                  <ShieldAlert className="size-3" /> Rechte: {check.rights.status === "clear" ? "geklärt" : "ungeklärt"}
                                </Badge>
                              )}
                              {j.slotMissedAt && <Badge tone="warn">Termin verstrichen</Badge>}
                            </div>
                            <p className="mt-auto pt-3 text-xs text-ink-3">
                              {j.slotMissedAt && j.suggestedSlotAt
                                ? `Neuer Vorschlag: ${formatDateTimeDe(j.suggestedSlotAt, j.system.timezone)}`
                                : j.targetSlotAt
                                  ? `Geplanter Slot: ${formatDateTimeDe(j.targetSlotAt, j.system.timezone)}`
                                  : "Kein Slot zugeordnet"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

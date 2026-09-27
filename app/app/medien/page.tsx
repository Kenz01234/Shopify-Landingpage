import Link from "next/link";
import { Download, FileAudio, Library } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge, DemoTag } from "@/components/ui/badge";
import { FormatTag, JobStatusBadge, Thumb } from "@/components/app/bits";
import { RIGHTS_LABEL } from "@/lib/autocheck";
import { formatDateTimeDe } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata = { title: "Medien" };

const KINDS = [
  { key: "alle", label: "Alle" },
  { key: "video", label: "Videos" },
  { key: "short", label: "Shorts" },
  { key: "audio", label: "Voiceover" },
] as const;

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ art?: string; system?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const kind = KINDS.find((k) => k.key === sp.art)?.key ?? "alle";
  const systems = await prisma.channelSystem.findMany({ where: { organizationId: viewer.org.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  const systemId = systems.find((s) => s.id === sp.system)?.id;
  const assets = await prisma.asset.findMany({
    where: {
      organizationId: viewer.org.id,
      kind: kind === "alle" ? { in: ["video", "short", "audio"] } : kind,
      ...(systemId ? { job: { systemId } } : {}),
    },
    include: {
      job: { select: { id: true, status: true, format: true, currentVersionId: true, system: { select: { name: true, timezone: true } } } },
      version: { select: { id: true, number: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
  const link = (k: string, s?: string) => `/app/medien?art=${k}${s ? `&system=${s}` : ""}`;
  return (
    <>
      <PageHeader title="Medienbibliothek" description="Alle Videos, Shorts und Voiceovers deiner Systeme – zum Ansehen und Herunterladen. Nur deine eigenen Dateien." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Medienart" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link key={k.key} href={link(k.key, systemId)} aria-current={k.key === kind ? "page" : undefined} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", k.key === kind ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
              {k.label}
            </Link>
          ))}
        </nav>
        {systems.length > 1 && (
          <nav aria-label="System" className="flex flex-wrap gap-1.5 sm:ml-auto">
            <Link href={link(kind)} className={cn("rounded-full px-3 py-1.5 text-sm", !systemId ? "font-semibold" : "text-ink-3")}>
              Alle Systeme
            </Link>
            {systems.map((s) => (
              <Link key={s.id} href={link(kind, s.id)} className={cn("rounded-full px-3 py-1.5 text-sm", systemId === s.id ? "font-semibold" : "text-ink-3")}>
                {s.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {assets.length === 0 ? (
        <EmptyState icon={<Library className="size-6" />} title="Noch keine Medien" text="Sobald Quest ein Video oder einen Short produziert hat, findest du die Dateien hier." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((a) => (
            <li key={a.id} className="card flex flex-col overflow-hidden">
              {a.kind === "audio" ? (
                <div className="grid aspect-video place-items-center border-b border-line bg-surface-2">
                  <FileAudio className="size-8 text-coral" aria-hidden />
                </div>
              ) : (
                <Thumb versionId={a.version?.id ?? a.job?.currentVersionId} title={a.version?.title ?? a.fileName} className="rounded-none border-0 border-b" />
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="line-clamp-2 font-semibold">{a.version?.title ?? a.fileName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  {a.kind === "audio" ? <Badge tone="neutral">Voiceover</Badge> : <FormatTag format={a.kind === "short" ? "short" : "longform"} />}
                  {a.job?.system.name} {a.version && `· Version ${a.version.number}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {a.job && <JobStatusBadge status={a.job.status} />}
                  <Badge tone={a.rightsStatus === "unknown" ? "warn" : "neutral"}>{RIGHTS_LABEL[a.rightsStatus]}</Badge>
                  {a.origin === "demo_fixture" && <DemoTag />}
                </div>
                <p className="mt-2 text-xs text-ink-3">
                  {a.durationSec ? `${Math.round(a.durationSec)} s · ` : ""}
                  {Math.round(a.sizeBytes / 1024)} KB · {formatDateTimeDe(a.createdAt, a.job?.system.timezone ?? "Europe/Berlin", "d. LLL yyyy")}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <a href={`/api/media/${a.id}?download=1`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-semibold hover:bg-surface-2">
                    <Download className="size-4" aria-hidden /> Herunterladen
                  </a>
                  <a href={`/api/media/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-ink-2 hover:bg-surface-3">
                    Öffnen
                  </a>
                  {a.job && (
                    <Link href={`/app/produktion/${a.job.id}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-coral-ink hover:bg-coral-soft">
                      Auftrag
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

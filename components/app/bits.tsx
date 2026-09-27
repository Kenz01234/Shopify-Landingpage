import { Film, Smartphone } from "lucide-react";
import type { JobStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, PUBLICATION_META, PIPELINE, pipelineIndex } from "@/lib/jobs/state";
import { cn } from "@/lib/cn";

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}

export function PublicationBadge({ status, className }: { status: string; className?: string }) {
  const m = PUBLICATION_META[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}

export function FormatTag({ format, className }: { format: "longform" | "short"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.72rem] font-semibold",
        format === "short" ? "bg-coral-soft text-coral-ink" : "bg-ink text-bg",
        className,
      )}
    >
      {format === "short" ? <Smartphone className="size-3" aria-hidden /> : <Film className="size-3" aria-hidden />}
      {format === "short" ? "Short" : "Video"}
    </span>
  );
}

/** Kompakte Pipeline-Anzeige für einen Auftrag. */
export function PipelineBar({ status, retryStep, compact = false }: { status: JobStatus; retryStep?: JobStatus | null; compact?: boolean }) {
  const idx = pipelineIndex(status, retryStep);
  const failed = status === "failed";
  const muted = status === "cancelled" || status === "rejected";
  return (
    <ol className={cn("flex items-center gap-1", compact ? "" : "w-full")} aria-label="Produktionsfortschritt">
      {PIPELINE.map((p, i) => {
        const done = !muted && (i < idx || (i === idx && status === "published"));
        const active = !muted && i === idx && status !== "published";
        return (
          <li key={p.status} className={cn("flex-1", compact && "w-4 flex-none")} title={p.label}>
            <span
              className={cn(
                "block h-1.5 rounded-full",
                done ? "bg-coral" : active ? (failed ? "bg-coral-deep" : "bg-coral/45") : "bg-surface-3",
                active && !failed && "animate-pulse motion-reduce:animate-none",
              )}
            />
            {!compact && (
              <span className={cn("mt-1.5 hidden text-[0.68rem] font-medium sm:block", done || active ? "text-ink-2" : "text-ink-3/70")}>{p.label}</span>
            )}
            <span className="sr-only">
              {p.label}: {done ? "erledigt" : active ? (failed ? "fehlgeschlagen" : "aktuell") : "offen"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Thumb({ versionId, title, className }: { versionId: string | null | undefined; title: string; className?: string }) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-3", className)}>
      {versionId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/thumbnails/${versionId}`} alt={`Thumbnail-Entwurf: ${title}`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full place-items-center text-xs text-ink-3">Noch kein Entwurf</div>
      )}
    </div>
  );
}

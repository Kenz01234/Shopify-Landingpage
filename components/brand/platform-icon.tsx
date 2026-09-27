import { Camera, Music2, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

/**
 * Neutrale Plattform-Symbole (keine nachgebildeten Markenlogos) in der Akzentfarbe der Plattform.
 * Der Plattformname steht immer dabei – die Farbe allein trägt keine Information.
 */
export function PlatformIcon({ platform, className }: { platform: PlatformKey; className?: string }) {
  const Icon = platform === "youtube" ? Play : platform === "instagram" ? Camera : Music2;
  return (
    <span
      aria-hidden
      className={cn("inline-grid size-5 shrink-0 place-items-center rounded-md text-white", className)}
      style={{
        background:
          platform === "instagram"
            ? "linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 55%,#962fbf 80%,#4f5bd5 100%)"
            : platform === "tiktok"
              ? "linear-gradient(135deg,#111 0%,#111 60%,#25f4ee 60%,#fe2c55 100%)"
              : PLATFORMS.youtube.accent,
      }}
    >
      <Icon className="size-[60%]" strokeWidth={2.4} fill={platform === "youtube" ? "currentColor" : "none"} />
    </span>
  );
}

const STATUS_DE: Record<string, { text: string; cls: string }> = {
  planned: { text: "geplant", cls: "text-ink-3" },
  pending: { text: "geplant", cls: "text-ink-3" },
  publishing: { text: "lädt hoch", cls: "text-coral-ink" },
  reconciling: { text: "wird abgeglichen", cls: "text-warn" },
  simulated: { text: "simuliert", cls: "text-ok-ink" },
  published: { text: "online", cls: "text-ok-ink" },
  failed: { text: "fehlgeschlagen", cls: "text-coral-ink" },
};

/** Plattform mit Namen und optionalem Status – z. B. in Freigabe, Kalender und Übersicht. */
export function PlatformChip({ platform, format = "short", status, url, className }: { platform: PlatformKey; format?: "short" | "longform"; status?: string; url?: string | null; className?: string }) {
  const label = format === "short" ? PLATFORMS[platform].shortLabel : PLATFORMS[platform].label;
  const st = status ? STATUS_DE[status] : null;
  const body = (
    <>
      <PlatformIcon platform={platform} className="size-4 rounded-[5px]" />
      <span className="font-medium text-ink">{label}</span>
      {st && <span className={cn("text-xs", st.cls)}>· {st.text}</span>}
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-sm", className);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={cn(cls, "hover:border-line-strong")}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/** Kompakte Reihe nur aus Symbolen (Kalender) – mit zugänglicher Beschriftung. */
export function PlatformIcons({ platforms, className }: { platforms: { platform: PlatformKey; status?: string }[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={platforms.map((p) => PLATFORMS[p.platform].label).join(", ")} role="img">
      {platforms.map((p) => (
        <PlatformIcon key={p.platform} platform={p.platform} className={cn("size-3.5 rounded-[4px]", p.status === "failed" && "opacity-40 grayscale")} />
      ))}
    </span>
  );
}

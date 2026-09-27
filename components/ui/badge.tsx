import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/jobs/state";

const tones: Record<StatusTone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  progress: "bg-info-soft text-info",
  review: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok-ink",
  scheduled: "bg-violet-soft text-violet",
  warn: "bg-warn-soft text-warn",
  error: "bg-coral-soft text-coral-ink",
  muted: "bg-surface-3 text-ink-3",
  demo: "bg-surface-3 text-ink-2 ring-1 ring-inset ring-line-strong",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: StatusTone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function DemoTag({ children = "Demo", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border border-dashed border-line-strong px-1.5 py-px text-[0.68rem] font-bold uppercase tracking-wider text-ink-3", className)}>
      {children}
    </span>
  );
}

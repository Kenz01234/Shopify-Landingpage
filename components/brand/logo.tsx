import { cn } from "@/lib/cn";

/**
 * Quest-Agent-Bildmarke: eine offene Schleife (der Loop) mit Abspiel-Dreieck,
 * deren Ende als „roter Faden“ weiterläuft. Bewusst kein Plattform-Logo.
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("shrink-0", className)} aria-hidden="true" focusable="false">
      <path
        d="M25.25 29.83A12.5 12.5 0 1 1 30.75 23.28"
        fill="none"
        stroke="var(--coral)"
        strokeWidth="4.2"
        strokeLinecap="round"
        className={animated ? "qa-logo-ring" : undefined}
      />
      <path
        d="M28.2 27.4c2.4 2.3 3.6 4.9 7.3 5.6"
        fill="none"
        stroke="var(--coral)"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M16.4 14.1c0-1.1 1.2-1.8 2.2-1.2l6.9 4.3c.9.6.9 1.9 0 2.5l-6.9 4.3c-1 .6-2.2-.1-2.2-1.2z"
        fill="var(--ink)"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-9", markClassName)} />
      <span className="font-display text-[1.28rem] font-bold leading-none tracking-[-0.035em] text-ink">
        Quest<span className="font-semibold text-ink-2"> Agent</span>
      </span>
    </span>
  );
}

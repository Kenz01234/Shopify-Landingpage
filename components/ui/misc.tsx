import Link from "next/link";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.035em] text-ink sm:text-[2.1rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, as: As = "section" }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <As className={cn("card p-5 sm:p-6", className)}>{children}</As>;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface-2/60 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-coral-soft text-coral">{icon}</div>}
      <p className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      <p className="text-[0.8rem] font-medium text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tracking-[-0.03em] tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[0.8rem] text-ink-3">{sub}</p>}
    </div>
  );
}

export function Meter({ used, reserved = 0, limit, label }: { used: number; reserved?: number; limit: number; label: string }) {
  const u = limit ? Math.min(100, (used / limit) * 100) : 0;
  const r = limit ? Math.min(100 - u, (reserved / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-3">
          <strong className="font-semibold text-ink">{used}</strong> verbraucht · {reserved} reserviert · {limit} gesamt
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used + reserved}
      >
        <span className="h-full bg-coral" style={{ width: `${u}%` }} />
        <span className="h-full bg-coral/35" style={{ width: `${r}%` }} />
      </div>
    </div>
  );
}

export function InlineAlert({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "error" | "ok"; title?: string; children: React.ReactNode; className?: string }) {
  const map = {
    info: "border-info/25 bg-info-soft text-ink",
    warn: "border-warn/30 bg-warn-soft text-ink",
    error: "border-coral/30 bg-coral-soft text-ink",
    ok: "border-ok/30 bg-ok-soft text-ink",
  };
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm", map[tone], className)} role={tone === "error" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-0.5", "text-ink-2")}>{children}</div>
    </div>
  );
}

import { TriangleAlert } from "lucide-react";

/** Rechtliche Seiten sind ausdrücklich Entwürfe mit fehlenden Angaben – keine fertigen Rechtstexte. */
export function LegalDraft({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-36 sm:px-6 sm:pt-44">
      <h1 className="font-display text-4xl font-bold tracking-[-0.04em]">{title}</h1>
      <div className="mt-6 flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <p>
          <strong>Entwurf – unvollständig.</strong> Dieser Text ist ein Platzhalter und keine geprüfte Rechtsberatung. Fehlende Unternehmensdaten sind mit <Missing>…</Missing>{" "}
          markiert und müssen vor einer Veröffentlichung ergänzt und rechtlich geprüft werden.
        </p>
      </div>
      <div className="prose-qa mt-10 space-y-5 text-ink-2 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.03em] [&_h2]:text-ink">{children}</div>
    </article>
  );
}

export function Missing({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-coral-soft px-1 font-medium text-coral-ink">[fehlt: {children}]</mark>;
}

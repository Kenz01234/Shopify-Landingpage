"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, ShieldCheck, ShieldAlert, Pencil, RotateCcw } from "lucide-react";
import { NicheScene } from "@/components/art/niche-scene";
import { SectionHeader } from "@/components/marketing/section-header";
import { cn } from "@/lib/cn";

const RULES = [
  { t: "Nichts ohne dich", d: "Kein Upload ohne deine ausdrückliche Freigabe – auch nicht, wenn ein Termin fällig ist." },
  { t: "Freigabe gilt für genau eine Version", d: "Änderst du danach etwas, entsteht eine neue Version. Die alte Freigabe erlischt." },
  { t: "Prüfung ist Hilfe, keine Freigabe", d: "Automatische Checks und Rechtestatus werden getrennt angezeigt – entscheiden tust du." },
];

const ORIGINAL = "Die Stadt, die über Nacht verschwand";

export function ApprovalDemo() {
  const reduce = useReducedMotion();
  const [title, setTitle] = useState(ORIGINAL);
  const [version, setVersion] = useState(1);
  const [approvedVersion, setApprovedVersion] = useState<number | null>(1);
  const approved = approvedVersion === version;

  const onEdit = (v: string) => {
    if (approved) setVersion((x) => x + 1);
    setTitle(v);
  };
  const reset = () => {
    setTitle(ORIGINAL);
    setVersion(1);
    setApprovedVersion(1);
  };

  return (
    <section className="relative py-24 sm:py-32" aria-labelledby="approval-title">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
        <div>
          <SectionHeader
            station="04"
            eyebrow="Kontrolle"
            id="approval-title"
            title={
              <>
                Du hast <span className="serif-accent text-coral">das letzte Wort.</span>
              </>
            }
            text="Probier es aus: Ändere den Titel rechts. Genau so verhält sich die Freigabe im Kundenbereich."
          />
          <ul className="mt-8 space-y-4">
            {RULES.map((r, i) => (
              <li key={r.t} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-coral/40 font-display text-sm font-bold text-coral-ink">{i + 1}</span>
                <div>
                  <p className="font-semibold">{r.t}</p>
                  <p className="text-ink-3">{r.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-float relative overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-2">Freigabe · Vergessene Geschichte</p>
            <span className="rounded-md border border-dashed border-line-strong px-1.5 py-px text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">Demo</span>
          </div>
          <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl">
            <NicheScene niche="history" kenBurns={!reduce} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            <p className="absolute bottom-4 left-4 right-24 font-display text-xl font-extrabold uppercase leading-tight text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.45)]">
              {title || "…"}
            </p>
            <motion.span
              key={version}
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur"
            >
              Version {version}
            </motion.span>
          </div>

          <label htmlFor="demo-title" className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <Pencil className="size-4 text-coral" aria-hidden /> Titel
          </label>
          <input
            id="demo-title"
            value={title}
            maxLength={100}
            onChange={(e) => onEdit(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 focus:border-coral/60 focus:outline-none focus:ring-2 focus:ring-coral/30"
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok-ink">
              <ShieldCheck className="size-4 shrink-0" aria-hidden /> Automatische Prüfung: ok
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              <ShieldAlert className="size-4 shrink-0" aria-hidden /> Rechte: 1 Clip ungeklärt
            </div>
          </div>

          <div className="mt-4 min-h-[4.5rem]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {approved ? (
                <motion.div
                  key="ok"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-3.5"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-ok text-white">
                    <Check className="size-5" strokeWidth={3} aria-hidden />
                  </span>
                  <p className="text-sm">
                    <strong>Version {version} freigegeben</strong>
                    <span className="block text-ink-3">Eingeplant: Do, 19:00 · Europe/Berlin</span>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="revoked"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-3.5 sm:flex-row sm:items-center"
                >
                  <p className="flex flex-1 items-start gap-2 text-sm">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                    <span>
                      <strong>Neue Version {version} – Freigabe aufgehoben.</strong>
                      <span className="block text-ink-3">Der Termin wird erst nach erneuter Freigabe wieder eingeplant.</span>
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setApprovedVersion(version)}
                    disabled={!title.trim()}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ok px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="size-4" aria-hidden /> Version {version} freigeben
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button type="button" onClick={reset} className={cn("mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink", version === 1 && "invisible")}>
            <RotateCcw className="size-3.5" aria-hidden /> Demo zurücksetzen
          </button>
        </div>
      </div>
    </section>
  );
}

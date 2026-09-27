"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Info } from "lucide-react";
import { SectionHeader } from "@/components/marketing/section-header";
import { PLANS, PLAN_ORDER, planLongformMinutes } from "@/lib/plans";
import { cn } from "@/lib/cn";

const FEATURES = ["Eigenes System aus Nische & Vorbildern", "KI-Stimme – du sprichst nichts ein", "Freigabe-Inbox mit Versionen", "Uploadkalender mit Zeitzonen", "Medienbibliothek & Downloads"];

export function Pricing({ station = "06", showHeader = true }: { station?: string; showHeader?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <section id="preise" className="relative scroll-mt-24 py-24 sm:py-32" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {showHeader && (
          <SectionHeader
            station={station}
            eyebrow="Preise"
            id="pricing-title"
            title={
              <>
                Zwei Pläne. <span className="serif-accent text-coral">Klare Mengen.</span>
              </>
            }
            text="Monatlich, mit festen Kontingenten für Videos und Shorts. Keine Einnahmen- oder Reichweitenversprechen."
          />
        )}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {PLAN_ORDER.map((k, i) => {
            const p = PLANS[k];
            const featured = k === "studio";
            const perMinute = (p.priceEurMonthly / planLongformMinutes(k)).toFixed(2).replace(".", ",");
            return (
              <motion.article
                key={k}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[2rem] border p-7 sm:p-9",
                  featured ? "grain border-transparent bg-ink text-bg" : "border-line bg-surface",
                )}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                aria-labelledby={`plan-${k}`}
              >
                <div className="relative z-[2] flex flex-1 flex-col">
                  <div className="flex items-center justify-between">
                    <h3 id={`plan-${k}`} className="font-display text-3xl font-bold tracking-[-0.04em]">
                      {p.name}
                    </h3>
                    {featured && <span className="rounded-full bg-coral-strong px-3 py-1 text-xs font-bold text-white">Mehr Takt</span>}
                  </div>
                  <p className={cn("mt-1", featured ? "opacity-75" : "text-ink-3")}>{p.tagline}</p>
                  <p className="mt-6">
                    <span className="font-display text-6xl font-bold tracking-[-0.05em]">{p.priceEurMonthly} €</span>
                    <span className={featured ? "opacity-70" : "text-ink-3"}> / Monat</span>
                  </p>
                  <div className={cn("mt-6 grid grid-cols-2 gap-3 rounded-2xl p-4", featured ? "bg-bg/10" : "bg-surface-2")}>
                    <div>
                      <p className="font-display text-2xl font-bold">{p.longformPerPeriod}</p>
                      <p className={cn("text-sm", featured ? "opacity-75" : "text-ink-3")}>Videos à {p.longformMaxMinutes} Min.</p>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-bold">{p.shortsPerPeriod}</p>
                      <p className={cn("text-sm", featured ? "opacity-75" : "text-ink-3")}>Shorts</p>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[0.95rem]">
                        <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-[#ff8a7f]" : "text-coral")} aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <p className={cn("mt-5 text-xs", featured ? "opacity-65" : "text-ink-3")}>
                    Rechnerisch {planLongformMinutes(k)} Longform-Minuten ≈ {perMinute} € pro Minute.
                  </p>
                  <Link
                    href={`/registrieren?plan=${k}`}
                    className={cn(
                      "mt-7 inline-flex h-13 items-center justify-center gap-2 rounded-full px-6 font-semibold transition",
                      featured ? "btn-shine bg-coral-strong text-white hover:bg-coral-deep" : "border border-line-strong bg-surface text-ink hover:border-ink/30",
                    )}
                  >
                    {p.name} wählen <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
        <p className="mx-auto mt-6 flex max-w-3xl items-start gap-2 text-sm text-ink-3">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Vorläufige Preise. Steuerdarstellung, maximale Shorts-Länge, Anzahl Systeme, Revisionen, Übertragbarkeit von Kontingenten und Vertragsbedingungen stehen noch
          nicht fest. Keine Garantie für Reichweite, Einnahmen oder eine Zulassung zum YouTube-Partnerprogramm.
        </p>
      </div>
    </section>
  );
}

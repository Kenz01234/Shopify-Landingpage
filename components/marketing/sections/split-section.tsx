"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { YOU_DO, QUEST_DOES } from "@/lib/marketing-content";
import { SectionHeader } from "@/components/marketing/section-header";

export function SplitSection() {
  const reduce = useReducedMotion();
  const item = (i: number) =>
    reduce
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true } }
      : {
          initial: { opacity: 0, x: 16 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, amount: 0.6 },
          transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
        };
  return (
    <section className="relative py-24 sm:py-32" aria-labelledby="split-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          station="02"
          eyebrow="Arbeitsteilung"
          id="split-title"
          title={
            <>
              Du führst Regie. <span className="serif-accent text-coral">Quest macht die Routine.</span>
            </>
          }
          text="Die Liste links ist bewusst kurz. Genau darum geht es."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="grain relative overflow-hidden rounded-[2rem] bg-ink p-7 text-bg sm:p-9">
            <p className="relative z-[2] text-sm font-bold uppercase tracking-[0.16em] opacity-70">Was du tust</p>
            <ul className="relative z-[2] mt-6 space-y-5">
              {YOU_DO.map((t, i) => (
                <motion.li key={t} {...item(i)} className="flex items-start gap-3 font-display text-2xl font-semibold leading-snug tracking-[-0.03em]">
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-bg/15 text-sm">{i + 1}</span>
                  {t}
                </motion.li>
              ))}
            </ul>
            <p className="relative z-[2] mt-10 max-w-sm text-sm opacity-75">Kein Gesicht, keine Aufnahme, kein Schnittprogramm. Du entscheidest – das reicht.</p>
          </div>
          <div className="rounded-[2rem] border border-line bg-surface p-7 sm:p-9">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral-ink">Was Quest übernimmt</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {QUEST_DOES.map((t, i) => (
                <motion.li key={t} {...item(i)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5 font-medium">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-coral text-white">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

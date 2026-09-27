"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioLines, BadgeCheck, CalendarCheck, Compass, FileText, Film, Lightbulb, RotateCw, Search, ShieldCheck, Smartphone } from "lucide-react";
import { LOOP_STEPS } from "@/lib/marketing-content";
import { SectionHeader } from "@/components/marketing/section-header";
import { cn } from "@/lib/cn";

const ICONS = [Compass, Lightbulb, Search, FileText, AudioLines, Film, Smartphone, ShieldCheck, BadgeCheck, CalendarCheck, RotateCw];

export function LoopSection() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const n = LOOP_STEPS.length;
  const R = 150;
  const C = 180;
  const pos = (i: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
  };
  const ActiveIcon = ICONS[active];
  const step = LOOP_STEPS[active];

  return (
    <section id="loop" className="relative scroll-mt-24 py-24 sm:py-32" aria-labelledby="loop-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          station="01"
          eyebrow="So läuft’s"
          id="loop-title"
          title={
            <>
              Ein Loop, elf Schritte. <span className="serif-accent text-coral">Zwei davon sind deine.</span>
            </>
          }
          text="Du gibst die Richtung vor und hast das letzte Wort. Alles dazwischen erledigt Quest – jede Woche wieder, in deinem Rhythmus."
        />

        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          {/* Ring (sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
                <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" aria-hidden>
                  <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth="2" />
                  <motion.circle
                    cx={C}
                    cy={C}
                    r={R}
                    fill="none"
                    stroke="var(--coral)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    transform={`rotate(-90 ${C} ${C})`}
                    initial={false}
                    animate={{ pathLength: (active + 1) / n }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 18 }}
                  />
                  {LOOP_STEPS.map((s, i) => {
                    const p = pos(i);
                    const done = i <= active;
                    return (
                      <g key={s.key}>
                        <motion.circle
                          cx={p.x}
                          cy={p.y}
                          initial={false}
                          animate={{ r: i === active ? 11 : 6.5 }}
                          fill={done ? (s.who === "du" ? "var(--ink)" : "var(--coral)") : "var(--surface)"}
                          stroke={s.who === "du" ? "var(--ink)" : "var(--coral)"}
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })}
                </svg>
                <div className="absolute inset-[22%] grid place-items-center rounded-full bg-surface text-center shadow-[0_30px_80px_-40px_rgb(var(--shadow-color)/0.45)] ring-1 ring-line">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
                      transition={{ duration: 0.35 }}
                      className="px-6"
                    >
                      <span className={cn("mx-auto grid size-12 place-items-center rounded-2xl", step.who === "du" ? "bg-ink text-bg" : "bg-coral-soft text-coral")}>
                        <ActiveIcon className="size-6" aria-hidden />
                      </span>
                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">
                        {String(active + 1).padStart(2, "0")} · {step.who === "du" ? "Du" : "Quest"}
                      </p>
                      <p className="mt-1 font-display text-xl font-bold leading-tight tracking-[-0.03em]">{step.title}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <p className="mt-6 flex items-center justify-center gap-5 text-sm text-ink-3">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-ink" aria-hidden /> Du
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-coral" aria-hidden /> Quest
                </span>
              </p>
            </div>
          </div>

          {/* Schritte */}
          <ol className="relative space-y-4 lg:space-y-6 lg:py-[18vh]">
            {LOOP_STEPS.map((s, i) => {
              const Icon = ICONS[i];
              const isActive = i === active;
              return (
                <motion.li
                  key={s.key}
                  onViewportEnter={() => setActive(i)}
                  viewport={{ margin: "-48% 0px -48% 0px" }}
                  className={cn(
                    "relative rounded-3xl border p-5 transition-[background,border-color,box-shadow,opacity] duration-500 sm:p-6",
                    isActive ? "border-coral/35 bg-surface shadow-[0_24px_60px_-36px_rgb(var(--shadow-color)/0.4)]" : "border-line bg-surface/60 lg:opacity-55",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", s.who === "du" ? "bg-ink text-bg" : "bg-coral-soft text-coral")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                        Schritt {i + 1} · {s.who === "du" ? "Du" : "Quest"}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-bold tracking-[-0.03em]">{s.title}</h3>
                      <p className="mt-1.5 text-ink-2">{s.text}</p>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

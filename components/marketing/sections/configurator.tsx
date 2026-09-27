"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Film, Smartphone, Sparkles, AlertTriangle } from "lucide-react";
import { SectionHeader } from "@/components/marketing/section-header";
import { parseYouTubeChannel } from "@/lib/youtube-url";
import { PLANS, type PlanKey } from "@/lib/plans";
import { WEEKDAYS_DE } from "@/lib/time";
import { cn } from "@/lib/cn";

const NICHES = ["Weltall & Wissen", "Geschichte & Antike", "Tiefsee & Meer", "Natur & Tiere", "Technik erklärt", "Psychologie im Alltag"];
const LONG_DAYS: Record<number, number[]> = { 0: [], 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
const SHORT_DAYS: Record<number, number[]> = { 0: [], 1: [6], 2: [2, 6], 3: [2, 4, 6], 4: [2, 4, 6, 7], 5: [1, 2, 4, 6, 7], 6: [1, 2, 3, 4, 6, 7], 7: [1, 2, 3, 4, 5, 6, 7] };
const WEEKS_PER_MONTH = 4.35;

function recommend(videosMonth: number, minutes: number, shortsMonth: number): PlanKey | null {
  if (videosMonth <= PLANS.starter.longformPerPeriod && minutes <= PLANS.starter.longformMaxMinutes && shortsMonth <= PLANS.starter.shortsPerPeriod) return "starter";
  if (videosMonth <= PLANS.studio.longformPerPeriod && minutes <= PLANS.studio.longformMaxMinutes && shortsMonth <= PLANS.studio.shortsPerPeriod) return "studio";
  return null;
}

/** Konfigurator: macht das eigene System greifbar und übergibt die Auswahl an Registrierung und Wizard. */
export function Configurator() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [niche, setNiche] = useState(NICHES[0]);
  const [refs, setRefs] = useState(["", ""]);
  const [perWeek, setPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(7);
  const [shortsWeek, setShortsWeek] = useState(3);

  const videosMonth = Math.round(perWeek * WEEKS_PER_MONTH);
  const shortsMonth = Math.round(shortsWeek * WEEKS_PER_MONTH);
  const plan = recommend(videosMonth, minutes, shortsMonth);
  const refState = refs.map((r) => (r.trim() ? parseYouTubeChannel(r) : null));
  const minutesPerMonth = videosMonth * minutes;

  const longDays = LONG_DAYS[perWeek];
  const shortDays = SHORT_DAYS[shortsWeek];

  const handoff = useMemo(() => {
    if (!plan) return null;
    const p = PLANS[plan];
    return {
      niche,
      referenceChannels: refs.map((r, i) => (refState[i]?.ok ? r.trim() : "")).filter(Boolean),
      longformEnabled: perWeek > 0,
      shortsEnabled: shortsWeek > 0,
      longformPerPeriod: perWeek > 0 ? Math.min(videosMonth, p.longformPerPeriod) : 0,
      longformMinutes: Math.min(minutes, p.longformMaxMinutes),
      shortsPerPeriod: shortsWeek > 0 ? Math.min(shortsMonth, p.shortsPerPeriod) : 0,
      slots: [
        ...longDays.map((d) => ({ format: "longform" as const, weekday: d, localTime: "18:00" })),
        ...shortDays.map((d) => ({ format: "short" as const, weekday: d, localTime: "12:00" })),
      ],
    };
  }, [plan, niche, refs, refState, perWeek, shortsWeek, videosMonth, shortsMonth, minutes, longDays, shortDays]);

  const start = () => {
    if (!plan || !handoff) return;
    try {
      sessionStorage.setItem("qa-configurator", JSON.stringify(handoff));
    } catch {
      /* ohne Speicher geht es trotzdem weiter */
    }
    router.push(`/registrieren?plan=${plan}`);
  };

  return (
    <section id="konfigurator" className="relative scroll-mt-24 py-24 sm:py-32" aria-labelledby="cfg-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          station="05"
          eyebrow="Konfigurator"
          id="cfg-title"
          title={
            <>
              Stell dir dein System <span className="serif-accent text-coral">zusammen.</span>
            </>
          }
          text="In 30 Sekunden sehen, was pro Monat entsteht und welcher Plan passt. Deine Auswahl nimmst du direkt in die Einrichtung mit."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="card space-y-8 p-6 sm:p-8">
            <fieldset>
              <legend className="mb-3 font-semibold">1 · Deine Nische</legend>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <label key={n} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-coral/40", niche === n ? "border-coral/60 bg-coral-soft font-semibold text-coral-ink" : "border-line hover:border-line-strong")}>
                    <input type="radio" name="cfg-niche" className="sr-only" checked={niche === n} onChange={() => setNiche(n)} />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-semibold">
                2 · Vorbilder <span className="font-normal text-ink-3">(optional)</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {refs.map((r, i) => (
                  <div key={i}>
                    <label htmlFor={`cfg-ref-${i}`} className="sr-only">
                      Referenzkanal {i + 1}
                    </label>
                    <input
                      id={`cfg-ref-${i}`}
                      value={r}
                      onChange={(e) => setRefs(refs.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={i === 0 ? "@kanalname" : "youtube.com/@kanal"}
                      className={cn(
                        "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-coral/30",
                        refState[i] && !refState[i]!.ok ? "border-coral" : "border-line-strong",
                      )}
                      aria-describedby={`cfg-ref-${i}-hint`}
                    />
                    <p id={`cfg-ref-${i}-hint`} className="mt-1 min-h-4 text-xs">
                      {refState[i] ? refState[i]!.ok ? <span className="text-ok-ink">✓ Kanal erkannt</span> : <span className="text-coral-ink">{(refState[i] as { error: string }).error}</span> : null}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-3">Nur als Stil-Signal. Es wird nichts abgerufen oder kopiert.</p>
            </fieldset>

            <fieldset className="space-y-6">
              <legend className="mb-1 font-semibold">3 · Dein Rhythmus</legend>
              <Slider id="cfg-v" label="Videos pro Woche" value={perWeek} min={0} max={7} onChange={setPerWeek} display={`${perWeek}`} />
              <Slider id="cfg-m" label="Länge pro Video" value={minutes} min={5} max={12} onChange={setMinutes} display={`${minutes} Min.`} />
              <Slider id="cfg-s" label="Shorts pro Woche" value={shortsWeek} min={0} max={7} onChange={setShortsWeek} display={`${shortsWeek}`} />
            </fieldset>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="grain relative overflow-hidden rounded-[2rem] bg-ink p-6 text-bg sm:p-8">
              <div className="relative z-[2]">
                <p className="text-sm font-bold uppercase tracking-[0.16em] opacity-70">Dein Monat mit Quest</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Metric value={videosMonth} label="Videos" />
                  <Metric value={minutesPerMonth} label="Video-Minuten" />
                  <Metric value={shortsMonth} label="Shorts" />
                </div>

                <div className="mt-6 rounded-2xl bg-bg/10 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-70">Deine Woche</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAYS_DE.map((d, i) => {
                      const hasV = longDays.includes(i + 1);
                      const hasS = shortDays.includes(i + 1);
                      return (
                        <div key={d} className="flex flex-col items-center gap-1">
                          <span className="text-[0.7rem] font-semibold opacity-70">{d}</span>
                          <div className="flex h-14 w-full flex-col items-center justify-center gap-1 rounded-lg bg-bg/10">
                            <AnimatePresence>
                              {hasV && (
                                <motion.span key="v" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid size-5 place-items-center rounded bg-coral text-white" title="Video 18:00">
                                  <Film className="size-3" aria-hidden />
                                </motion.span>
                              )}
                              {hasS && (
                                <motion.span key="s" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid size-5 place-items-center rounded bg-bg text-ink" title="Short 12:00">
                                  <Smartphone className="size-3" aria-hidden />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {plan ? (
                    <motion.div
                      key={plan}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0 }}
                      className="mt-6"
                    >
                      <p className="flex items-center gap-2 text-sm opacity-80">
                        <Sparkles className="size-4 text-[#ff8a7f]" aria-hidden /> Passender Plan
                      </p>
                      <p className="mt-1 font-display text-4xl font-bold tracking-[-0.04em]">
                        {PLANS[plan].name} <span className="text-lg font-medium opacity-70">{PLANS[plan].priceEurMonthly} € / Monat</span>
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm opacity-90">
                        <li className="flex gap-2">
                          <Check className="size-4 text-[#ff8a7f]" aria-hidden /> bis {PLANS[plan].longformPerPeriod} Videos à {PLANS[plan].longformMaxMinutes} Min. + {PLANS[plan].shortsPerPeriod} Shorts
                        </li>
                        <li className="flex gap-2">
                          <Check className="size-4 text-[#ff8a7f]" aria-hidden /> Nische „{niche}“, Uploadplan übernommen
                        </li>
                      </ul>
                    </motion.div>
                  ) : (
                    <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 flex items-start gap-2 rounded-2xl bg-bg/10 p-3 text-sm">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ffb35c]" aria-hidden />
                      Das übersteigt die aktuellen Pakete (max. {PLANS.studio.longformPerPeriod} Videos à {PLANS.studio.longformMaxMinutes} Min. und {PLANS.studio.shortsPerPeriod} Shorts pro Monat). Reduziere Rhythmus oder Länge.
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={start}
                  disabled={!plan}
                  className="btn-shine mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-coral-strong px-6 text-base font-semibold text-white shadow-[0_16px_36px_-14px_rgba(213,48,45,0.9)] transition hover:bg-coral-deep disabled:opacity-50"
                >
                  Mit diesem Setup starten <ArrowRight className="size-4" aria-hidden />
                </button>
                <p className="mt-3 text-center text-xs opacity-70">Konto anlegen → Plan bestätigen (Demo, keine Zahlung) → Einrichtung vorbefüllt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-2xl bg-bg/10 p-3">
      <motion.p key={value} initial={reduce ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-3xl font-bold tabular-nums tracking-[-0.04em]">
        {value}
      </motion.p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function Slider({ id, label, value, min, max, onChange, display }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; display: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        <span className="font-display text-lg font-bold tabular-nums">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="qa-range w-full"
        style={{ background: `linear-gradient(to right, var(--coral) ${pct}%, var(--surface-3) ${pct}%)` }}
      />
    </div>
  );
}

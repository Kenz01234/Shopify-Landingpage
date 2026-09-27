"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  Film,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Undo2,
  AudioLines,
  X,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { NicheScene, NICHES, NICHE_ORDER, type NicheKey } from "@/components/art/niche-scene";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------
   Ablauf der Hero-Demo. Bis zur Freigabe ca. 7,7 Sekunden, danach
   wartet die Sequenz auf den Menschen. Keine echte Veröffentlichung.
   ------------------------------------------------------------------ */

const PHASES = [
  { key: "config", ms: 1300, label: "Dein System wird eingerichtet" },
  { key: "loop", ms: 800, label: "Daraus entsteht dein Quest-Loop" },
  { key: "research", ms: 950, label: "Recherche & Rohmaterial" },
  { key: "script", ms: 950, label: "Skript wird geschrieben" },
  { key: "voice", ms: 950, label: "KI-Stimme spricht das Skript" },
  { key: "video", ms: 950, label: "Video wird geschnitten" },
  { key: "shorts", ms: 900, label: "Shorts entstehen" },
  { key: "check", ms: 900, label: "Automatische Prüfung" },
  { key: "review", ms: 0, label: "Wartet auf deine Freigabe" },
  { key: "scheduled", ms: 2600, label: "Freigegeben und eingeplant" },
  { key: "next", ms: 0, label: "Nächster Zyklus wird vorbereitet" },
] as const;

type PhaseKey = (typeof PHASES)[number]["key"];
const idx = (k: PhaseKey) => PHASES.findIndex((p) => p.key === k);

const STEPS = [
  { key: "research", title: "Recherche", sub: "Themen, Fakten, Rohmaterial", icon: Search },
  { key: "script", title: "Skript", sub: "Eigener Text, dein Ton", icon: FileText },
  { key: "voice", title: "KI-Stimme", sub: "Du sprichst nichts ein", icon: AudioLines },
  { key: "video", title: "Video", sub: "Schnitt, Musik, Untertitel", icon: Film },
  { key: "shorts", title: "Shorts", sub: "Hochkant-Clips", icon: Smartphone },
  { key: "check", title: "Auto-Prüfung", sub: "Technik, Länge, Rechte", icon: ShieldCheck },
] as const;

export type HeroLoopHandle = { restart: () => void };

export const HeroLoop = forwardRef<HeroLoopHandle, { className?: string }>(function HeroLoop({ className }, ref) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.12 });
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [started, setStarted] = useState(false);
  const [niche, setNiche] = useState<NicheKey>("space");
  const [revision, setRevision] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = PHASES[phase];
  const nextNiche = NICHE_ORDER[(NICHE_ORDER.indexOf(niche) + 1) % NICHE_ORDER.length];

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const restart = useCallback(() => {
    clear();
    setRevision(false);
    setPhase(0);
    setPlaying(true);
    setStarted(true);
  }, []);

  useImperativeHandle(ref, () => ({ restart }), [restart]);

  useEffect(() => {
    if (inView && !started) setStarted(true);
  }, [inView, started]);

  useEffect(() => {
    clear();
    if (!started || !playing || !inView) return;
    const ms = current.ms;
    if (!ms) return; // wartet auf Nutzer (Freigabe) oder Ende
    timer.current = setTimeout(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), ms);
    return clear;
  }, [phase, playing, started, inView, current.ms]);

  const approve = () => {
    setRevision(false);
    setPhase(idx("scheduled"));
    setPlaying(true);
  };
  const requestChanges = () => {
    setRevision(true);
    setPhase(idx("script"));
    setPlaying(true);
  };
  const chooseNiche = (k: NicheKey) => {
    setNiche(k);
    restart();
  };
  const step = (dir: 1 | -1) => {
    setPlaying(false);
    setPhase((p) => Math.max(0, Math.min(PHASES.length - 1, p + dir)));
  };

  const p = phase;
  const showProduction = p >= idx("loop");
  const showVideo = p >= idx("shorts");
  const showShort = p >= idx("check");
  const showApproval = p === idx("review");
  const scheduled = p >= idx("scheduled");
  const isNext = p === idx("next");

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, y: 14, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(4px)" },
        transition: { type: "spring" as const, stiffness: 260, damping: 26 },
      };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Steuerleiste */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
            <span className="size-1.5 rounded-full bg-coral" aria-hidden /> Demo-Ablauf
          </span>
          <span className="hidden sm:inline" aria-live="polite">
            <span className="sr-only">Aktueller Schritt: </span>
            {revision && p <= idx("check") ? "Überarbeitung: " : ""}
            {current.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div role="tablist" aria-label="Beispiel-Nische" className="mr-1 hidden items-center gap-1 rounded-full border border-line bg-surface p-1 md:flex">
            {NICHE_ORDER.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={niche === k}
                onClick={() => chooseNiche(k)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition",
                  niche === k ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-3",
                )}
              >
                {NICHES[k].label}
              </button>
            ))}
          </div>
          {!playing && (
            <>
              <IconButton label="Schritt zurück" onClick={() => step(-1)} disabled={p === 0}>
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton label="Nächster Schritt" onClick={() => step(1)} disabled={p >= PHASES.length - 1 || showApproval}>
                <ChevronRight className="size-4" />
              </IconButton>
            </>
          )}
          <IconButton label={playing ? "Animation pausieren" : "Animation fortsetzen"} onClick={() => setPlaying((v) => !v)}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </IconButton>
          <IconButton label="Von vorne abspielen" onClick={restart}>
            <RotateCcw className="size-4" />
          </IconButton>
        </div>
      </div>

      <LayoutGroup id="hero-loop">
        <div className="relative grid gap-5 md:gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.3fr)_minmax(0,1.08fr)] lg:items-start lg:gap-12">
          {/* 1 – Konfiguration */}
          <motion.section
            aria-label="Dein System (Beispielkonfiguration)"
            className="card-float relative z-10 p-5"
            {...fade}
          >
            <header className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[1.02rem] font-semibold tracking-[-0.02em]">
                <SlidersHorizontal className="size-[18px] text-coral" aria-hidden /> Dein System
              </h3>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-3">Beispiel</span>
            </header>
            <ConfigRow show={p >= 0} delay={0} reduce={reduce} label="Nische">
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-coral/50 bg-coral-soft px-3 py-1 text-sm font-medium text-coral-ink">
                  <span className="size-1.5 rounded-full bg-coral" aria-hidden />
                  {NICHES[niche].label}
                </span>
                <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-ink-2">Wissen</span>
              </div>
            </ConfigRow>
            <ConfigRow show={p >= 0} delay={0.25} reduce={reduce} label="Referenzkanäle">
              <ul className="space-y-1.5">
                {[0, 1].map((i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-2.5 py-2">
                    <span
                      className="size-7 shrink-0 rounded-full"
                      style={{
                        background:
                          i === 0
                            ? "conic-gradient(from 200deg, #f7b267, #e83936, #6d4bd8, #f7b267)"
                            : "conic-gradient(from 20deg, #7ec4ff, #2f5bd3, #1b7f45, #7ec4ff)",
                      }}
                      aria-hidden
                    />
                    <span className="flex-1 space-y-1" aria-hidden>
                      <span className="skeleton-line block w-[70%]" />
                      <span className="skeleton-line block w-[42%] opacity-70" />
                    </span>
                    <span className="sr-only">Referenzkanal {i + 1}</span>
                    <X className="size-3.5 text-ink-3" aria-hidden />
                  </li>
                ))}
                <li className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-1.5 text-xs text-ink-3">
                  <Plus className="size-3.5" aria-hidden /> Kanal hinzufügen
                </li>
              </ul>
            </ConfigRow>
            <ConfigRow show={p >= 0} delay={0.5} reduce={reduce} label="Uploadplan · Europe/Berlin">
              <div className="grid gap-1.5 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-ink-3" aria-hidden /> Mo · Mi · Fr, 18:00
                  </span>
                  <span className="rounded-md bg-ink px-1.5 py-0.5 text-[0.7rem] font-semibold text-bg">Video</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-ink-3" aria-hidden /> Täglich, 12:00
                  </span>
                  <span className="rounded-md bg-coral-soft px-1.5 py-0.5 text-[0.7rem] font-semibold text-coral-ink">Short</span>
                </div>
              </div>
            </ConfigRow>
            <Connector show={p >= idx("loop")} reduce={reduce} className="-right-12 top-[44%] hidden lg:block" />
          </motion.section>

          {/* 2 – Produktion */}
          <AnimatePresence mode="popLayout" initial={false}>
            {showProduction ? (
              <motion.section
                key={isNext ? "next" : "prod"}
                aria-label="Produktion"
                className="card-float relative z-10 p-5"
                {...fade}
              >
                <header className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-[1.02rem] font-semibold tracking-[-0.02em]">
                    <Sparkles className="size-[18px] text-coral" aria-hidden />
                    {isNext ? "Nächster Zyklus" : "Quest arbeitet für dich"}
                  </h3>
                  <span className="whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[0.72rem] font-medium text-ink-3">
                    {isNext ? `Nische: ${NICHES[nextNiche].label}` : "Demoproduktion"}
                  </span>
                </header>
                {isNext ? (
                  <NextCycle niche={nextNiche} reduce={reduce} />
                ) : (
                  <ol className="relative space-y-1.5">
                    {STEPS.map((s, i) => {
                      const stepPhase = idx(s.key);
                      const state = p > stepPhase ? "done" : p === stepPhase ? "active" : "pending";
                      return (
                        <StepRow key={s.key} step={s} state={state} niche={niche} reduce={reduce} index={i} revision={revision} />
                      );
                    })}
                  </ol>
                )}
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <motion.div
                    className="h-full rounded-full bg-coral"
                    initial={false}
                    animate={{ width: `${isNext ? 8 : Math.min(100, Math.max(0, ((p - 1) / 7) * 100))}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 24 }}
                  />
                </div>
                <Connector show={showVideo && !isNext} reduce={reduce} className="-right-12 top-[38%] hidden lg:block" />
              </motion.section>
            ) : (
              <motion.div
                key="prod-placeholder"
                className="hidden min-h-[26rem] rounded-[var(--radius-card)] border border-dashed border-line lg:block"
                aria-hidden
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>

          {/* 3 – Ergebnis, Freigabe, Kalender */}
          <div className="relative z-10 min-h-[25rem] sm:min-h-[27rem]">
            <div className="relative">
              {/* Landscape-Video */}
              <div className="relative aspect-video w-[80%] overflow-hidden rounded-2xl border border-line bg-surface-3 shadow-[0_30px_60px_-30px_rgb(var(--shadow-color)/0.45)]">
                <AnimatePresence initial={false}>
                  {showVideo && !scheduled ? (
                    <motion.div key={`v-${niche}`} layoutId={reduce ? undefined : "hero-video"} className="absolute inset-0" {...(reduce ? fade : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 } })}>
                      <VideoFace niche={niche} />
                    </motion.div>
                  ) : scheduled ? (
                    <motion.div key="v-done" className="absolute inset-0 grid place-items-center bg-surface-2 text-center text-sm text-ink-3" {...fade}>
                      <span className="flex items-center gap-2">
                        <Check className="size-4 text-ok-ink" aria-hidden /> Im Kalender eingeplant
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div key="v-empty" className="absolute inset-0 grid place-items-center" {...fade}>
                      <span className="flex items-center gap-2 text-sm text-ink-3">
                        <Film className="size-4" aria-hidden /> Video entsteht …
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Portrait-Short */}
              <div className="absolute right-0 top-[18%] aspect-[9/16] w-[30%] overflow-hidden rounded-2xl border-[3px] border-surface bg-surface-3 shadow-[0_24px_50px_-24px_rgb(var(--shadow-color)/0.55)]">
                <AnimatePresence initial={false}>
                  {showShort ? (
                    <motion.div key={`s-${niche}`} className="absolute inset-0" {...(reduce ? fade : { initial: { opacity: 0, y: 24, rotate: 4 }, animate: { opacity: 1, y: 0, rotate: 0 }, exit: { opacity: 0 }, transition: { type: "spring", stiffness: 200, damping: 20 } })}>
                      <NicheScene niche={niche} kenBurns={!reduce} className="absolute inset-0" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-x-2 bottom-2 text-white">
                        <p className="font-display text-[0.8rem] font-bold uppercase leading-tight tracking-[0.02em] [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
                          {NICHES[niche].shortTitle}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-[0.68rem] font-medium opacity-90">
                          <Play className="size-3 fill-current" aria-hidden /> Short · 0:45
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="s-empty" className="absolute inset-0 grid place-items-center" {...fade}>
                      <Smartphone className="size-5 text-ink-3" aria-label="Short entsteht" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Freigabe bzw. Kalender */}
            <div className="relative mt-4 sm:mt-[18%] sm:w-[88%] lg:mt-[20%]">
              <AnimatePresence mode="wait" initial={false}>
                {showApproval && (
                  <motion.div key="approval" className="card-float relative p-4" {...fade} role="group" aria-label="Freigabe">
                    <p className="flex items-center gap-2 font-display text-[1.05rem] font-semibold tracking-[-0.02em]">
                      Du hast das letzte Wort.
                    </p>
                    <p className="mt-1 text-[0.82rem] leading-snug text-ink-3">
                      Automatische Prüfung bestanden – sie ersetzt deine Freigabe nicht. Termin: Mi, 18:00.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={requestChanges}
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink-2 transition hover:border-coral/60 hover:text-coral-ink"
                      >
                        <Undo2 className="size-4" aria-hidden /> Überarbeiten
                      </button>
                      <motion.button
                        type="button"
                        onClick={approve}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ok px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(27,127,69,0.7)] animate-pulse-ring"
                        whileHover={reduce ? undefined : { scale: 1.02 }}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                      >
                        <Check className="size-[18px]" aria-hidden /> Freigeben
                      </motion.button>
                    </div>
                  </motion.div>
                )}
                {scheduled && (
                  <motion.div key="calendar" className="card-float p-4" {...fade}>
                    <MiniCalendar niche={niche} reduce={reduce} highlight={p === idx("scheduled")} />
                  </motion.div>
                )}
                {!showApproval && !scheduled && (
                  <motion.div
                    key="waiting"
                    className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-3"
                    {...fade}
                  >
                    Ergebnisse landen zur Prüfung bei dir – nichts geht ohne deine Freigabe online.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </LayoutGroup>

      {/* Rückführung: der Loop schließt sich */}
      <ReturnLoop show={p >= idx("scheduled")} reduce={reduce} />

      {/* Mobile: Nischenwahl */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none md:hidden" role="tablist" aria-label="Beispiel-Nische">
        {NICHE_ORDER.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={niche === k}
            onClick={() => chooseNiche(k)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              niche === k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2",
            )}
          >
            {NICHES[k].label}
          </button>
        ))}
      </div>
    </div>
  );
});

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink-2 transition hover:border-line-strong hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ConfigRow({
  show,
  delay,
  reduce,
  label,
  children,
}: {
  show: boolean;
  delay: number;
  reduce: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="mb-3.5 last:mb-0"
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 8 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="mb-1.5 text-[0.78rem] font-semibold text-ink-2">{label}</p>
      {children}
    </motion.div>
  );
}

function StepRow({
  step,
  state,
  niche,
  reduce,
  index,
  revision,
}: {
  step: (typeof STEPS)[number];
  state: "pending" | "active" | "done";
  niche: NicheKey;
  reduce: boolean;
  index: number;
  revision: boolean;
}) {
  const Icon = step.icon;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-300",
        state === "active" ? "border-coral/40 bg-coral-soft/60" : "border-transparent",
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-300",
          state === "done" && "border-coral bg-coral text-white",
          state === "active" && "border-coral/60 bg-surface text-coral",
          state === "pending" && "border-line bg-surface-2 text-ink-3",
        )}
      >
        {state === "done" ? (
          <motion.span initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </motion.span>
        ) : state === "active" ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Icon className="size-3.5" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[0.9rem] font-semibold leading-tight", state === "pending" ? "text-ink-3" : "text-ink")}>
          {step.title}
          {revision && step.key === "script" && state !== "pending" ? (
            <span className="ml-1.5 rounded bg-warn-soft px-1 py-px text-[0.68rem] font-semibold text-warn">Überarbeitung</span>
          ) : null}
        </span>
        <span className="block truncate text-[0.76rem] text-ink-3">{step.sub}</span>
      </span>
      <span className="hidden w-[7.25rem] shrink-0 justify-end sm:flex" aria-hidden>
        <StepVisual kind={step.key} state={state} niche={niche} reduce={reduce} index={index} />
      </span>
      <span className="sr-only">{state === "done" ? "erledigt" : state === "active" ? "läuft" : "wartet"}</span>
    </li>
  );
}

function StepVisual({
  kind,
  state,
  niche,
  reduce,
}: {
  kind: (typeof STEPS)[number]["key"];
  state: "pending" | "active" | "done";
  niche: NicheKey;
  reduce: boolean;
  index: number;
}) {
  if (state === "pending") return <span className="skeleton-line block w-2/3 opacity-60" />;
  switch (kind) {
    case "research":
      return (
        <span className="flex flex-wrap justify-end gap-1">
          {NICHES[niche].topics.slice(0, 2).map((t, i) => (
            <motion.span
              key={t}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.18 }}
              className="whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-[0.68rem] text-ink-2"
            >
              {t}
            </motion.span>
          ))}
        </span>
      );
    case "script":
      return (
        <span className="w-full space-y-1">
          {[88, 70, 80].map((w, i) => (
            <motion.span
              key={i}
              className="skeleton-line block bg-ink/15"
              initial={reduce ? false : { width: "0%" }}
              animate={{ width: `${w}%` }}
              transition={{ delay: i * 0.2, duration: 0.5, ease: "easeOut" }}
            />
          ))}
        </span>
      );
    case "voice":
      return (
        <span className="flex h-6 items-center gap-[3px]">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={cn("w-[3px] origin-center rounded-full bg-coral", state === "active" && !reduce && "animate-wave")}
              style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 6) * 0.09}s` }}
            />
          ))}
        </span>
      );
    case "video":
      return (
        <span className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="relative h-6 w-9 overflow-hidden rounded-[5px] border border-line"
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.14 }}
            >
              <span className="absolute inset-0" style={{ transform: `scale(${1.6 + i * 0.35}) translate(${i * -6}%, ${i * 4}%)` }}>
                <NicheScene niche={niche} />
              </span>
            </motion.span>
          ))}
        </span>
      );
    case "shorts":
      return (
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="relative h-8 w-[18px] overflow-hidden rounded-[4px] border border-line"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.14 }}
            >
              <span className="absolute inset-0" style={{ transform: `scale(${2 + i * 0.4})` }}>
                <NicheScene niche={niche} />
              </span>
            </motion.span>
          ))}
        </span>
      );
    case "check":
      return (
        <span className="whitespace-nowrap rounded-full bg-ok-soft px-2 py-0.5 text-[0.7rem] font-semibold text-ok-ink">
          {state === "done" ? "6/6 Checks" : "prüft …"}
        </span>
      );
  }
}

function VideoFace({ niche }: { niche: NicheKey }) {
  return (
    <>
      <NicheScene niche={niche} kenBurns className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/15 to-transparent" />
      <div className="absolute left-[6%] top-1/2 max-w-[62%] -translate-y-1/2 text-white">
        <p className="font-display text-[clamp(0.85rem,1.5vw,1.15rem)] font-extrabold uppercase leading-[1.05] tracking-[0.01em] [text-shadow:0_2px_14px_rgb(0_0_0/0.45)]">
          {NICHES[niche].sampleTitle}
        </p>
      </div>
      <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-2 text-white">
        <Play className="size-3.5 fill-current" aria-hidden />
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
          <span className="block h-full w-[22%] rounded-full bg-coral" />
        </span>
        <span className="text-[0.68rem] font-medium tabular-nums">Longform · 10:00</span>
      </div>
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
        Beispielgrafik
      </span>
    </>
  );
}

function MiniCalendar({ niche, reduce, highlight }: { niche: NicheKey; reduce: boolean; highlight: boolean }) {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-coral" aria-hidden /> Uploadplan · diese Woche
        </p>
        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[0.7rem] font-semibold text-ok-ink">Freigegeben</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const video = i === 0 || i === 2 || i === 4;
          return (
            <div key={d} className="flex flex-col items-center gap-1">
              <span className="text-[0.66rem] font-semibold text-ink-3">{d}</span>
              <div className={cn("relative h-10 w-full rounded-lg border", video ? "border-line-strong bg-surface-2" : "border-line bg-surface")}>
                {i === 2 && (
                  <motion.div
                    layoutId={reduce ? undefined : "hero-video"}
                    className="absolute inset-0.5 overflow-hidden rounded-md ring-2 ring-coral"
                    transition={{ type: "spring", stiffness: 170, damping: 22 }}
                  >
                    <NicheScene niche={niche} />
                  </motion.div>
                )}
                <span className="absolute -bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-coral/70" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
      <motion.p
        className="mt-2.5 text-[0.8rem] leading-snug text-ink-2"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: highlight ? 0.5 : 0 }}
      >
        Eingeplant: <strong className="font-semibold text-ink">Mi, 18:00</strong> · Punkte = tägliche Shorts.{" "}
        <span className="text-ink-3">Demo – es wird nichts veröffentlicht.</span>
      </motion.p>
    </div>
  );
}

function NextCycle({ niche, reduce }: { niche: NicheKey; reduce: boolean }) {
  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-line">
        <NicheScene niche={niche} kenBurns={!reduce} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute bottom-2 left-3 right-3 font-display text-sm font-bold uppercase text-white">{NICHES[niche].sampleTitle}</p>
      </div>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2 text-ink">
          <span className="grid size-6 place-items-center rounded-full border border-coral/60 text-coral">
            <Search className="size-3.5" aria-hidden />
          </span>
          Themenvorschläge aus deiner Nische werden gesammelt
        </li>
        <li className="flex items-center gap-2 text-ink-3">
          <span className="grid size-6 place-items-center rounded-full border border-line">
            <CalendarDays className="size-3.5" aria-hidden />
          </span>
          Ziel: nächster freier Slot in deinem Uploadplan
        </li>
      </ul>
    </div>
  );
}

function Connector({ show, reduce, className }: { show: boolean; reduce: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={cn("pointer-events-none absolute h-10 w-12 overflow-visible", className)} aria-hidden>
      <motion.path
        d="M2 30 C 16 30, 20 10, 40 10"
        fill="none"
        stroke="var(--coral)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.7, ease: "easeInOut" }}
      />
      <motion.path
        d="M35 5 L41 10 L35 15"
        fill="none"
        stroke="var(--coral)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ opacity: show ? 1 : 0 }}
        transition={{ delay: reduce ? 0 : 0.55, duration: 0.2 }}
      />
    </svg>
  );
}

function ReturnLoop({ show, reduce }: { show: boolean; reduce: boolean }) {
  return (
    <div className="relative mt-6 hidden h-14 lg:block" aria-hidden={!show}>
      <svg viewBox="0 0 1000 56" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <motion.path
          d="M900 4 C 900 40, 860 44, 700 44 L 300 44 C 140 44, 100 40, 100 4"
          fill="none"
          stroke="var(--coral)"
          strokeWidth="2"
          strokeDasharray="1 0"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ pathLength: show ? 1 : 0, opacity: show ? 0.9 : 0 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
      <AnimatePresence>
        {show && (
          <motion.span
            className="absolute left-1/2 top-[44px] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-coral/40 bg-surface px-3.5 py-1.5 text-sm font-medium text-coral-ink shadow-sm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: reduce ? 0 : 0.8 }}
          >
            <RotateCcw className="size-4" aria-hidden /> Automatisch zum nächsten Zyklus
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

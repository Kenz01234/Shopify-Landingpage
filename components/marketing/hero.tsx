"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, CalendarClock, Clapperboard, Compass, EyeOff, MicOff, Play } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HeroLoop, type HeroLoopHandle } from "@/components/marketing/hero-loop";

const BENEFITS = [
  { icon: EyeOff, title: "Ohne Gesicht", text: "Keine Kamera, kein Auftritt." },
  { icon: MicOff, title: "Ohne Einsprechen", text: "Eine KI-Stimme spricht deine Skripte." },
  { icon: Compass, title: "Dein eigenes System", text: "Aus deiner Nische und deinen Vorbildern." },
  { icon: Clapperboard, title: "Videos & Shorts", text: "Aus einem automatisierten Prozess." },
  { icon: CalendarClock, title: "Dein Rhythmus", text: "Tage, Uhrzeiten, Zeitzone – du bestimmst." },
  { icon: BadgeCheck, title: "Prüfen statt produzieren", text: "Du gibst frei, Quest erledigt den Rest." },
];

function Words({ text, className, delay = 0, reduce }: { text: string; className?: string; delay?: number; reduce: boolean }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className={`inline-block ${className ?? ""}`}
            initial={reduce ? { opacity: 0 } : { y: "105%", opacity: 0, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1 } : { y: "0%", opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: reduce ? 0.2 : 0.9, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const loopRef = useRef<HeroLoopHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const discover = () => {
    stageRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    loopRef.current?.restart();
    stageRef.current?.focus({ preventScroll: true });
  };

  const fadeUp = (d: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 16, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.8, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative pt-28 sm:pt-32" aria-labelledby="hero-title">
      {/* Atmosphäre */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[62rem] overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-[-18rem] h-[44rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--peach),transparent)] opacity-80" />
        <div className="absolute right-[-12rem] top-[18rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,var(--coral-glow),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
          style={{
            backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <motion.p
          {...fadeUp(0)}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-coral/25 bg-surface/80 px-3.5 py-1.5 text-[0.82rem] font-medium text-coral-ink shadow-sm backdrop-blur sm:text-sm"
          data-thread-anchor="start"
        >
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-coral" />
          </span>
          YouTube-Automation. Ohne Kamera. Ohne Einsprechen.
        </motion.p>

        <h1
          id="hero-title"
          className="mx-auto mt-6 max-w-5xl font-display text-[clamp(2.7rem,8.4vw,6.4rem)] font-[780] leading-[0.95] tracking-[-0.055em] text-ink"
        >
          <span className="block">
            <Words text="Dein Faceless-Kanal." reduce={reduce} />
          </span>
          <span className="block text-coral">
            <Words text="Läuft" reduce={reduce} delay={0.25} />{" "}
            <Words text="für dich." reduce={reduce} delay={0.33} className="serif-accent pr-[0.06em] text-[1.08em] tracking-[-0.02em]" />
          </span>
        </h1>

        <motion.p {...fadeUp(0.45)} className="mx-auto mt-6 max-w-2xl text-lg font-medium text-ink-2 sm:text-xl">
          Nische und Vorbilder wählen. Uploadplan festlegen. Prüfen, freigeben, fertig.
        </motion.p>
        <motion.p {...fadeUp(0.55)} className="mx-auto mt-2 max-w-xl text-[0.98rem] text-ink-3">
          Quest Agent übernimmt Recherche, Skript, KI-Stimme und Produktion – du behältst das letzte Wort.
        </motion.p>

        <motion.div {...fadeUp(0.65)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/registrieren" size="lg" shine className="w-full sm:w-auto">
            Eigenes System erstellen <ArrowRight className="size-[18px]" aria-hidden />
          </ButtonLink>
          <button
            type="button"
            onClick={discover}
            className="group inline-flex h-13 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-6 text-base font-semibold text-ink transition hover:border-ink/30 sm:w-auto"
          >
            <span className="grid size-7 place-items-center rounded-full bg-ink text-bg transition group-hover:scale-110">
              <Play className="size-3.5 translate-x-[1px] fill-current" aria-hidden />
            </span>
            Den Loop entdecken
          </button>
        </motion.div>
        <motion.p {...fadeUp(0.75)} className="mt-4 text-[0.82rem] text-ink-3">
          Demo ohne Zahlung testen · Keine Erfolgsgarantie – aber weniger Routine.
        </motion.p>
      </div>

      {/* Bühne */}
      <motion.div
        {...fadeUp(0.8)}
        ref={stageRef}
        tabIndex={-1}
        id="demo"
        className="relative mx-auto mt-14 max-w-[76rem] scroll-mt-24 px-4 outline-none sm:px-6"
        aria-label="Interaktive Produktdemo"
      >
        <div className="grain relative overflow-hidden rounded-[2rem] border border-line bg-bg-tint/70 p-4 shadow-[0_40px_120px_-60px_rgb(var(--shadow-color)/0.35)] backdrop-blur-sm sm:p-6 lg:p-8">
          <div className="relative z-[2]">
            <HeroLoop ref={loopRef} />
          </div>
        </div>
      </motion.div>

      {/* Sechs Kernvorteile */}
      <div className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-line bg-line min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Die sechs Kernvorteile">
          {BENEFITS.map((b, i) => (
            <motion.li
              key={b.title}
              className="flex items-start gap-3 bg-surface p-4 sm:p-5 xl:flex-col xl:gap-2.5"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral">
                <b.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-[1rem] font-semibold tracking-[-0.02em]">{b.title}</span>
                <span className="mt-0.5 block text-sm text-ink-3">{b.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

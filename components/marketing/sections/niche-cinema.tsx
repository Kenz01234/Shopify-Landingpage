"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { NicheScene, NICHES, NICHE_ORDER } from "@/components/art/niche-scene";
import { SectionHeader } from "@/components/marketing/section-header";

export function NicheCinema() {
  const reduce = useReducedMotion();
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(560, el.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <section className="relative py-24 sm:py-32" aria-labelledby="niche-title">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          station="03"
          eyebrow="Nischen"
          id="niche-title"
          title={
            <>
              Jede Nische, die sich <span className="serif-accent text-coral">erzählen lässt.</span>
            </>
          }
          text="Wissen, Geschichte, Natur, Technik – alles, was ohne Gesicht funktioniert. Die Motive hier sind Beispielgrafiken."
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} className="grid size-12 place-items-center rounded-full border border-line bg-surface hover:border-line-strong" aria-label="Zurück blättern">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} className="grid size-12 place-items-center rounded-full border border-line bg-surface hover:border-line-strong" aria-label="Weiter blättern">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 scrollbar-none sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
        aria-label="Beispiel-Nischen"
      >
        {NICHE_ORDER.map((k, i) => (
          <motion.li
            key={k}
            className="group relative aspect-[4/5] w-[78vw] max-w-[22rem] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-line bg-surface-3 shadow-[0_30px_70px_-40px_rgb(var(--shadow-color)/0.6)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, rotate: i % 2 ? 1.5 : -1.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 120, damping: 20 }}
          >
            <div className="absolute inset-0 transition-transform duration-[1.6s] ease-out group-hover:scale-[1.06] motion-reduce:transition-none">
              <NicheScene niche={k} className="absolute inset-0" title={`Beispielgrafik ${NICHES[k].label}`} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/10" />
            <span className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
              {NICHES[k].label}
            </span>
            <div className="absolute inset-x-5 bottom-5 text-white">
              <p className="font-display text-2xl font-bold leading-[1.05] tracking-[-0.03em] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">{NICHES[k].sampleTitle}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-white/80">
                <span className="grid size-7 place-items-center rounded-full bg-white/20 backdrop-blur">
                  <Play className="size-3.5 fill-current" aria-hidden />
                </span>
                Video + Shorts · Beispielgrafik
              </p>
            </div>
          </motion.li>
        ))}
        <li className="flex aspect-[4/5] w-[78vw] max-w-[22rem] shrink-0 snap-start flex-col justify-end rounded-[1.75rem] border border-dashed border-line-strong p-6">
          <p className="font-display text-2xl font-bold tracking-[-0.03em]">Deine Nische?</p>
          <p className="mt-2 text-ink-3">Psychologie, Mysterien, Tierwelt, Städte, Erfindungen – du legst sie im Konfigurator fest.</p>
          <a href="#konfigurator" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-bg">
            Zum Konfigurator
          </a>
        </li>
      </ul>
    </section>
  );
}

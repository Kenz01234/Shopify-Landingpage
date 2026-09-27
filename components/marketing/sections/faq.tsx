"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { FAQ } from "@/lib/marketing-content";
import { SectionHeader } from "@/components/marketing/section-header";
import { cn } from "@/lib/cn";

export function FaqList({ items = FAQ }: { items?: readonly { q: string; a: string }[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line rounded-[2rem] border border-line bg-surface">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                id={`faq-btn-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-display text-lg font-semibold tracking-[-0.02em] sm:px-7"
              >
                {f.q}
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border border-line transition-transform duration-300", isOpen && "rotate-45 border-coral/40 text-coral")}>
                  <Plus className="size-4" aria-hidden />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`faq-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-6 text-ink-2 sm:px-7">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="relative scroll-mt-24 py-24 sm:py-32" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <SectionHeader station="07" eyebrow="FAQ" id="faq-title" title="Ehrliche Antworten." text="Was du selbst tust, wie Freigabe und Planung funktionieren – und was wir nicht versprechen." />
        <FaqList />
      </div>
    </section>
  );
}

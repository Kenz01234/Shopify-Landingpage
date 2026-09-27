"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export function FinalCta() {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden py-28 sm:py-40" aria-labelledby="final-title" id="start">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[40rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--peach),transparent)] opacity-90" />
      </div>
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -90 }}
          whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 90, damping: 14 }}
          className="mx-auto w-fit"
        >
          <LogoMark className="size-16" />
        </motion.div>
        <h2 id="final-title" className="mt-8 font-display text-[clamp(2.6rem,7vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.05em]">
          Hier beginnt <span className="serif-accent text-coral">dein Loop.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">Konto anlegen, Plan bestätigen, System einrichten. Die Demo läuft ohne Zahlung – und ohne dass irgendetwas veröffentlicht wird.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <span className="relative inline-flex">
            <span data-thread-anchor="end" className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2" aria-hidden />
            <span className="qa-knot pointer-events-none absolute -inset-2.5 rounded-full border-2 border-coral" aria-hidden />
            <Link
              href="/registrieren"
              className="btn-shine relative inline-flex h-14 items-center gap-2 rounded-full bg-coral-strong px-8 text-lg font-semibold text-white shadow-[0_20px_44px_-16px_rgba(213,48,45,0.9)] transition hover:bg-coral-deep"
            >
              Eigenes System erstellen <ArrowRight className="size-5" aria-hidden />
            </Link>
          </span>
          <Link href="/demo" className="inline-flex h-14 items-center rounded-full border border-line-strong bg-surface px-7 text-lg font-semibold hover:border-ink/30">
            Demo öffnen
          </Link>
        </div>
      </div>
    </section>
  );
}

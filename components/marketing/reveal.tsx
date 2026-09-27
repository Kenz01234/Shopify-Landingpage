"use client";

import { motion, useReducedMotion } from "motion/react";

/** Sanftes Einblenden beim Scrollen: Unschärfe + leichte Aufwärtsbewegung, einmalig. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
  y = 18,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header";
  y?: number;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduce ? 0.2 : 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}

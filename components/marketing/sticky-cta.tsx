"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";

/** Mobile Handlungsleiste: erscheint nach dem Hero, verschwindet am Seitenende. */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => {
      const end = document.getElementById("start");
      const nearEnd = end ? end.getBoundingClientRect().top < window.innerHeight : false;
      setShow(window.scrollY > 900 && !nearEnd);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-3 bottom-3 z-40 md:hidden"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        >
          <div className="card-float flex items-center gap-2 rounded-full p-1.5 pl-4">
            <p className="flex-1 text-sm font-semibold leading-tight">
              Dein Faceless-Kanal
              <span className="block text-xs font-normal text-ink-3">Demo ohne Zahlung</span>
            </p>
            <Link href="/registrieren" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-coral-strong px-4 text-sm font-semibold text-white">
              Starten <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

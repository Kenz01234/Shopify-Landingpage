"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/#loop", label: "So läuft’s" },
  { href: "/funktionen", label: "Funktionen" },
  { href: "/preise", label: "Preise" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full px-3 transition-[background,box-shadow,border-color] duration-300 sm:h-16 sm:px-4",
          scrolled || open
            ? "border border-line bg-surface/80 shadow-[0_10px_40px_-20px_rgb(var(--shadow-color)/0.3)] backdrop-blur-xl"
            : "border border-transparent",
        )}
      >
        <Link href="/" className="rounded-full px-1" aria-label="Quest Agent – Startseite">
          <Logo markClassName="size-8 sm:size-9" />
        </Link>
        <nav aria-label="Hauptnavigation" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[0.94rem] font-medium text-ink-2 transition hover:bg-surface-3 hover:text-ink",
                    pathname === n.href && "text-ink",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle compact />
          <Link href="/login" className="hidden rounded-full px-3 py-2 text-[0.94rem] font-medium text-ink-2 hover:text-ink lg:inline-block">
            Anmelden
          </Link>
          <span className="hidden min-[480px]:inline-flex">
            <ButtonLink href="/demo" size="sm" className="h-10 px-4">
              Demo öffnen <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </span>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile Navigation"
            className="card-float mx-auto mt-2 max-w-6xl p-3 md:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <ul className="grid gap-1">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-lg font-medium text-ink hover:bg-surface-3">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-lg font-medium text-ink hover:bg-surface-3">
                  Anmelden
                </Link>
              </li>
            </ul>
            <div className="mt-2 grid gap-2 border-t border-line pt-3">
              <ButtonLink href="/registrieren" size="md" onClick={() => setOpen(false)}>
                Eigenes System erstellen <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/demo" variant="secondary" size="md" onClick={() => setOpen(false)}>
                Demo öffnen
              </ButtonLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

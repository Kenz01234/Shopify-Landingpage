"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BadgeCheck,
  CalendarDays,
  Clapperboard,
  CreditCard,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Plug,
  Plus,
  Shield,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type ShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; isAdmin: boolean };
  orgName: string;
  plan: { name: string; status: string } | null;
  demo: { enabled: boolean; clockOffsetMinutes: number };
  initialReview: number;
};

const NAV = [
  { href: "/app", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/app/systeme", label: "Systeme", icon: Workflow },
  { href: "/app/produktion", label: "Produktion", icon: Clapperboard },
  { href: "/app/freigaben", label: "Freigaben", icon: BadgeCheck, badge: true },
  { href: "/app/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/app/medien", label: "Medien", icon: Library },
  { href: "/app/verbindungen", label: "Verbindungen", icon: Plug },
  { href: "/app/abo", label: "Abo", icon: CreditCard },
  { href: "/app/konto", label: "Konto", icon: UserRound },
];

export function AppShell({ children, user, orgName, plan, demo, initialReview }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(initialReview);
  const [worker, setWorker] = useState<{ alive: boolean; running: number } | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/status", { credentials: "same-origin" });
        if (!r.ok) return;
        const j = (await r.json()) as { review: number; running: number; workerAlive: boolean };
        if (!alive) return;
        setReview(j.review);
        setWorker({ alive: j.workerAlive, running: j.running });
      } catch {
        /* offline – nächster Versuch */
      }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const logout = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Kundenbereich" className="flex flex-1 flex-col">
      <Link
        href="/app/systeme/neu"
        className="mb-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-coral-strong px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(213,48,45,0.8)] transition hover:bg-coral-deep"
      >
        <Plus className="size-4" aria-hidden /> Neues System erstellen
      </Link>
      <ul className="space-y-0.5">
        {[...NAV, ...(user.isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : [])].map((item) => {
          const active = isActive(item.href, "exact" in item ? item.exact : false);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] font-medium transition-colors",
                  active ? "text-ink" : "text-ink-2 hover:bg-surface-3/70 hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={reduce ? undefined : "nav-active"}
                    className="absolute inset-0 rounded-xl border border-line bg-surface shadow-[0_6px_18px_-10px_rgb(var(--shadow-color)/0.25)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <item.icon className={cn("relative size-[18px]", active ? "text-coral" : "text-ink-3")} aria-hidden />
                <span className="relative flex-1">{item.label}</span>
                {"badge" in item && item.badge && review > 0 && (
                  <span className="relative rounded-full bg-coral-strong px-2 py-px text-xs font-bold text-white" aria-label={`${review} offen`}>
                    {review}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-2xl border border-line bg-surface p-3.5 text-sm">
          <p className="font-semibold text-ink">{orgName}</p>
          <p className="mt-0.5 text-ink-3">{plan ? `${plan.name} · ${plan.status}` : "Kein aktiver Plan"}</p>
          <p className="mt-2 flex items-center gap-2 text-[0.8rem] text-ink-3">
            <span className={cn("size-2 rounded-full", worker === null ? "bg-line-strong" : worker.alive ? "bg-ok" : "bg-coral")} aria-hidden />
            {worker === null ? "Worker-Status wird geprüft …" : worker.alive ? `Worker aktiv${worker.running ? ` · ${worker.running} in Arbeit` : ""}` : "Worker nicht erreichbar"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
          </div>
          <ThemeToggle compact />
          <button
            type="button"
            onClick={logout}
            className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink"
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <a href="#app-inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
          Zum Inhalt springen
        </a>
        <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface-2 px-4 py-5 lg:flex">
          <Link href="/app" className="mb-6 px-2" aria-label="Quest Agent – Übersicht">
            <Logo markClassName="size-8" />
          </Link>
          {nav}
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
            <Link href="/app" aria-label="Quest Agent – Übersicht">
              <Logo markClassName="size-7" className="scale-95" />
            </Link>
            <div className="flex items-center gap-2">
              {review > 0 && (
                <Link href="/app/freigaben" className="rounded-full bg-coral-strong px-2.5 py-1 text-xs font-bold text-white">
                  {review} Freigabe{review === 1 ? "" : "n"}
                </Link>
              )}
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full border border-line bg-surface"
                aria-label={open ? "Menü schließen" : "Menü öffnen"}
                aria-expanded={open}
                aria-controls="app-drawer"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </header>
          <AnimatePresence>
            {open && (
              <>
                <motion.div className="fixed inset-0 z-40 bg-black/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
                <motion.div
                  id="app-drawer"
                  className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-line bg-surface-2 px-4 py-5 lg:hidden"
                  initial={reduce ? { opacity: 0 } : { x: "-100%" }}
                  animate={reduce ? { opacity: 1 } : { x: 0 }}
                  exit={reduce ? { opacity: 0 } : { x: "-100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                >
                  <div className="mb-6 flex items-center justify-between px-2">
                    <Logo markClassName="size-8" />
                    <button className="grid size-9 place-items-center rounded-full hover:bg-surface-3" onClick={() => setOpen(false)} aria-label="Menü schließen">
                      <X className="size-5" />
                    </button>
                  </div>
                  {nav}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {demo.enabled && (
            <div className="border-b border-line bg-surface-2/80 px-4 py-2 text-[0.8rem] text-ink-3 sm:px-8">
              <span className="font-semibold text-ink-2">Demo-Modus:</span> Recherche, Stimme, Produktion, Upload und Zahlung werden simuliert – es wird nichts veröffentlicht oder abgebucht.
              {demo.clockOffsetMinutes !== 0 && (
                <span className="ml-1 font-semibold text-warn">
                  Demo-Uhr vorgestellt um {Math.round((demo.clockOffsetMinutes / 60) * 10) / 10} h.
                </span>
              )}
            </div>
          )}
          <main id="app-inhalt" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-9">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

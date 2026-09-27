"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type Pref = "light" | "dark" | "system";

function resolve(pref: Pref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function apply(pref: Pref, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const next = resolve(pref);
  const commit = () => {
    root.dataset.theme = next;
    root.dataset.themePref = pref;
  };
  try {
    localStorage.setItem("qa-theme", pref);
  } catch {
    /* Speicher nicht verfügbar – Einstellung gilt nur für diese Sitzung */
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || reduce || root.dataset.theme === next) {
    commit();
    return;
  }
  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 32;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = doc.startViewTransition(commit);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => undefined);
}

const labels: Record<Pref, string> = { light: "Hell", dark: "Dunkel", system: "System" };

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useState<Pref>("light");

  useEffect(() => {
    const stored = (document.documentElement.dataset.themePref as Pref) || "light";
    setPref(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((document.documentElement.dataset.themePref as Pref) === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const order: Pref[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(pref) + 1) % order.length];
    setPref(next);
    const rect = e.currentTarget.getBoundingClientRect();
    apply(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  const Icon = pref === "dark" ? Moon : pref === "system" ? Monitor : Sun;
  const nextLabel = labels[(["light", "dark", "system"] as Pref[])[(["light", "dark", "system"].indexOf(pref) + 1) % 3]];

  return (
    <button
      type="button"
      onClick={cycle}
      className={`group inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 text-ink-2 backdrop-blur transition hover:border-line-strong hover:text-ink ${compact ? "h-10 w-10 justify-center" : "h-10 px-3.5 text-sm"}`}
      aria-label={`Farbschema: ${labels[pref]}. Wechseln zu ${nextLabel}`}
      title={`Farbschema: ${labels[pref]}`}
    >
      <Icon className="size-[18px] transition-transform duration-500 group-hover:rotate-[20deg]" aria-hidden />
      {!compact && <span className="font-medium">{labels[pref]}</span>}
    </button>
  );
}

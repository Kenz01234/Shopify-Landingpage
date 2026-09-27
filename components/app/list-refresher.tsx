"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Aktualisiert Listen, sobald sich im Backend etwas bewegt (Polling auf /api/status). */
export function ListRefresher({ interval = 3000 }: { interval?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    let stop = false;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/status", { credentials: "same-origin" });
        if (!r.ok || stop) return;
        const j = (await r.json()) as { review: number; running: number };
        const sig = `${j.review}:${j.running}`;
        if (last.current !== null && last.current !== sig) router.refresh();
        last.current = sig;
      } catch {
        /* ignorieren */
      }
    }, interval);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [interval, router]);
  return null;
}

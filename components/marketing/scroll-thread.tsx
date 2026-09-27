"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useMotionValueEvent, useSpring } from "motion/react";

/**
 * „Der rote Faden“: Eine Linie, die sich beim Scrollen durch die Seite zieht und an den
 * Stationen (Elemente mit data-thread-anchor) vorbeiführt – bis zum Einstieg am Seitenende.
 * Die Spitze folgt der Leseposition (ca. 62 % der Viewport-Höhe), nicht einfach dem Scrollanteil.
 */
type Pt = { x: number; y: number };

function smoothPath(pts: Pt[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.5;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * t * 2, y: p1.y + ((p2.y - p0.y) / 6) * t * 2 };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * t * 2, y: p2.y - ((p3.y - p1.y) / 6) * t * 2 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function ScrollThread({ containerId }: { containerId: string }) {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<{ d: string; w: number; h: number; top: number } | null>(null);
  const lut = useRef<{ len: number; y: number; x: number }[]>([]);
  const total = useRef(0);
  const offset = useMotionValue(1);
  const smooth = useSpring(offset, { stiffness: 120, damping: 28, mass: 0.6 });
  const headX = useMotionValue(0);
  const headY = useMotionValue(0);
  const headOpacity = useMotionValue(0);
  const { scrollY } = useScroll();

  const measure = useCallback(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const w = container.clientWidth;
    // Nur wenn neben dem Inhalt genug Rand ist – sonst würde der Faden Text kreuzen.
    if (w < 1232) {
      setGeo(null);
      return;
    }
    const rect = container.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const margin = Math.max(28, Math.min(72, (w - 1152) / 2 - 24));
    const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-thread-anchor]"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top, kind: el.dataset.threadAnchor };
      })
      .sort((a, b) => a.y - b.y);
    if (anchors.length < 2) return;
    const pts: Pt[] = [];
    anchors.forEach((a, i) => {
      if (i > 0) {
        const prev = anchors[i - 1];
        const gap = a.y - prev.y;
        pts.push({ x: margin, y: prev.y + Math.min(140, gap * 0.25) });
        if (gap > 420) pts.push({ x: margin + (i % 2 ? 14 : -8), y: prev.y + gap * 0.55 });
        if (a.kind === "end") {
          // Von unten links an den Einstieg heranführen, nicht quer durch die Überschrift
          pts.push({ x: margin, y: a.y + 80 });
          pts.push({ x: a.x - 220, y: a.y + 64 });
        } else {
          pts.push({ x: margin, y: a.y - Math.min(140, gap * 0.25) });
        }
      }
      pts.push({ x: a.x, y: a.y });
    });
    setGeo({ d: smoothPath(pts), w, h: container.scrollHeight, top });
  }, [containerId]);

  useEffect(() => {
    measure();
    const container = document.getElementById(containerId);
    const ro = new ResizeObserver(() => measure());
    if (container) ro.observe(container);
    document.fonts?.ready.then(() => measure()).catch(() => undefined);
    const t = setTimeout(measure, 1200);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [containerId, measure]);

  const update = useCallback(
    (y: number) => {
      const table = lut.current;
      if (!geo || !table.length) return;
      const target = y + window.innerHeight * 0.62 - geo.top;
      let lo = 0;
      let hi = table.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (table[mid].y < target) lo = mid + 1;
        else hi = mid;
      }
      const hit = table[Math.max(0, lo)];
      const atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 24;
      const drawn = atBottom ? total.current : target <= table[0].y ? 0 : target >= table[table.length - 1].y ? total.current : hit.len;
      const done = drawn >= total.current - 1;
      if (done !== (document.documentElement.dataset.threadDone === "1")) document.documentElement.dataset.threadDone = done ? "1" : "0";
      offset.set(1 - drawn / total.current);
      const tip = atBottom ? table[table.length - 1] : hit;
      headX.set(tip.x);
      headY.set(tip.y);
      headOpacity.set(drawn > 4 && drawn < total.current - 4 ? 1 : 0);
    },
    [geo, offset, headX, headY, headOpacity],
  );

  useEffect(() => {
    const p = pathRef.current;
    if (!p || !geo) return;
    const len = p.getTotalLength();
    total.current = len;
    const N = 500;
    const arr: { len: number; y: number; x: number }[] = [];
    let maxY = -Infinity;
    for (let i = 0; i <= N; i++) {
      const l = (len * i) / N;
      const pt = p.getPointAtLength(l);
      maxY = Math.max(maxY, pt.y);
      arr.push({ len: l, y: maxY, x: pt.x });
    }
    lut.current = arr;
    update(window.scrollY);
  }, [geo, update]);

  useMotionValueEvent(scrollY, "change", (v) => update(v));

  if (!geo) return null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-visible"
      width={geo.w}
      height={geo.h}
      viewBox={`0 0 ${geo.w} ${geo.h}`}
    >
      <path d={geo.d} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.8" />
      <motion.path
        ref={pathRef}
        d={geo.d}
        fill="none"
        stroke="var(--coral)"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        style={{ strokeDashoffset: reduce ? 0 : smooth }}
      />
      {!reduce && (
        <motion.g style={{ x: headX, y: headY, opacity: headOpacity }}>
          <circle r="12" fill="var(--coral-glow)" />
          <circle r="5" fill="var(--coral)" />
          <circle r="2" fill="#fff" />
        </motion.g>
      )}
    </svg>
  );
}

/** Stationsmarke, durch die der Faden läuft. */
export function Station({ n, className = "" }: { n: string; className?: string }) {
  return (
    <span
      data-thread-anchor="station"
      className={`relative z-10 inline-grid size-9 shrink-0 place-items-center rounded-full border border-coral/40 bg-surface font-display text-xs font-bold text-coral-ink shadow-[0_0_0_6px_var(--bg)] ${className}`}
      aria-hidden
    >
      {n}
    </span>
  );
}

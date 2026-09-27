import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Cinematische Beispielgrafiken für mehrere Nischen – vollständig als SVG im Code
 * gezeichnet (keine Fremdbilder, keine Lizenzfragen). Dienen als Demo-Motive.
 */

export type NicheKey = "space" | "history" | "ocean" | "nature" | "tech";

export const NICHES: Record<
  NicheKey,
  { label: string; sampleTitle: string; shortTitle: string; topics: string[] }
> = {
  space: {
    label: "Weltall",
    sampleTitle: "Was, wenn es noch andere Welten gibt?",
    shortTitle: "Unendliche Welten",
    topics: ["Exoplaneten", "Habitable Zone", "Teleskopdaten"],
  },
  history: {
    label: "Geschichte",
    sampleTitle: "Die Stadt, die über Nacht verschwand",
    shortTitle: "Verlorene Städte",
    topics: ["Antike Handelswege", "Ausgrabungen", "Zeitzeugnisse"],
  },
  ocean: {
    label: "Tiefsee",
    sampleTitle: "Was lebt in 4.000 Metern Tiefe?",
    shortTitle: "Leuchten im Dunkeln",
    topics: ["Biolumineszenz", "Druck & Kälte", "Neue Arten"],
  },
  nature: {
    label: "Natur",
    sampleTitle: "Der Wald, der miteinander spricht",
    shortTitle: "Stille Netzwerke",
    topics: ["Wurzelnetze", "Jahreszeiten", "Ökosysteme"],
  },
  tech: {
    label: "Technik",
    sampleTitle: "Wie ein Chip in Nanosekunden denkt",
    shortTitle: "Denken in Silizium",
    topics: ["Transistoren", "Rechenwerke", "Energiebedarf"],
  },
};

export const NICHE_ORDER: NicheKey[] = ["space", "history", "ocean", "nature", "tech"];

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Viele kleine Kreise als ein einziger Pfad – schont den DOM. */
function dotsPath(seed: number, count: number, w: number, h: number, rMin: number, rMax: number, yMax = h) {
  const rand = rng(seed);
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * yMax;
    const r = rMin + rand() * (rMax - rMin);
    d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
  }
  return d;
}

function SpaceScene({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#040613" />
          <stop offset="0.55" stopColor="#0a1333" />
          <stop offset="1" stopColor="#1b0f2e" />
        </linearGradient>
        <radialGradient id={`${id}-neb1`} cx="0.3" cy="0.35" r="0.5">
          <stop offset="0" stopColor="#8a2f7a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8a2f7a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-neb2`} cx="0.7" cy="0.2" r="0.45">
          <stop offset="0" stopColor="#2a5bd0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2a5bd0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-planet`} cx="0.32" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="0.28" stopColor="#3a86c8" />
          <stop offset="0.62" stopColor="#123b6e" />
          <stop offset="1" stopColor="#050d1f" />
        </radialGradient>
        <radialGradient id={`${id}-atmo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.86" stopColor="#7fc4ff" stopOpacity="0" />
          <stop offset="0.93" stopColor="#7fc4ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7fc4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.2" stopColor="#ffe3a3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff9a5a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e9e4dc" />
          <stop offset="1" stopColor="#4b4a52" />
        </radialGradient>
        <linearGradient id={`${id}-bands`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.4" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <rect width="1600" height="900" fill={`url(#${id}-neb1)`} />
      <rect width="1600" height="900" fill={`url(#${id}-neb2)`} />
      <path d={dotsPath(11, 170, 1600, 900, 0.6, 1.4)} fill="#fff" opacity="0.55" />
      <path d={dotsPath(23, 40, 1600, 900, 1.2, 2.2)} fill="#fff" opacity="0.85" />
      <circle cx="840" cy="300" r="170" fill={`url(#${id}-sun)`} />
      <ellipse cx="840" cy="300" rx="420" ry="6" fill="#fff2d6" opacity="0.45" filter={`url(#${id}-blur)`} />
      <circle cx="1180" cy="930" r="560" fill={`url(#${id}-atmo)`} transform="scale(1.02) translate(-24 -18)" />
      <circle cx="1180" cy="930" r="540" fill={`url(#${id}-planet)`} />
      <circle cx="1180" cy="930" r="540" fill={`url(#${id}-bands)`} />
      <path d="M700 820c160-110 420-150 700-80" stroke="#bfe6ff" strokeOpacity="0.28" strokeWidth="3" fill="none" />
      <path d="M740 900c180-90 400-120 640-60" stroke="#bfe6ff" strokeOpacity="0.16" strokeWidth="2" fill="none" />
      <circle cx="390" cy="230" r="44" fill={`url(#${id}-moon)`} />
    </>
  );
}

function HistoryScene({ id }: { id: string }) {
  const cols = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1838" />
          <stop offset="0.38" stopColor="#8e3b52" />
          <stop offset="0.62" stopColor="#e3794f" />
          <stop offset="0.8" stopColor="#f7b267" />
          <stop offset="1" stopColor="#fbd48f" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4d0" />
          <stop offset="0.35" stopColor="#ffd88a" />
          <stop offset="1" stopColor="#ffb36b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0" />
          <stop offset="1" stopColor="#ffd9a0" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <circle cx="930" cy="560" r="260" fill={`url(#${id}-sun)`} />
      <circle cx="930" cy="560" r="96" fill="#fff0c2" opacity="0.95" />
      <path d="M0 640 C 260 590 420 610 620 640 S 1020 600 1240 620 1480 600 1600 610 V900 H0Z" fill="#b8566a" opacity="0.55" />
      <rect y="560" width="1600" height="340" fill={`url(#${id}-haze)`} />
      <path d="M0 720 C 300 650 520 660 760 690 S 1200 650 1600 700 V900 H0Z" fill="#5a2a3e" />
      <g fill="#3a1a2b">
        <path d="M560 600 L760 540 L960 600 Z" />
        <rect x="575" y="598" width="370" height="16" />
        {cols.map((i) => (
          <rect key={i} x={594 + i * 62} y="614" width="22" height="120" rx="3" />
        ))}
        <rect x="560" y="730" width="400" height="18" />
      </g>
      <path d="M0 780 C 380 730 700 760 980 790 S 1400 760 1600 780 V900 H0Z" fill="#2a1322" />
      <g stroke="#2a1322" strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M1150 330 l14 10 l14 -10" />
        <path d="M1210 300 l10 7 l10 -7" />
        <path d="M1080 360 l9 6 l9 -6" />
      </g>
    </>
  );
}

function OceanScene({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#11718f" />
          <stop offset="0.35" stopColor="#0a3d5a" />
          <stop offset="1" stopColor="#020a14" />
        </linearGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff8ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#dff8ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-jelly`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffd6f4" />
          <stop offset="0.5" stopColor="#ff7ad9" stopOpacity="0.75" />
          <stop offset="1" stopColor="#6b3cff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7ef9ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7ef9ff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sea)`} />
      <g filter={`url(#${id}-soft)`}>
        <path d="M520 0 L640 0 L420 900 L260 900Z" fill={`url(#${id}-ray)`} />
        <path d="M760 0 L820 0 L760 900 L640 900Z" fill={`url(#${id}-ray)`} />
        <path d="M980 0 L1080 0 L1260 900 L1080 900Z" fill={`url(#${id}-ray)`} />
      </g>
      <path d={dotsPath(7, 90, 1600, 900, 0.8, 2.2)} fill="#bff4ff" opacity="0.4" />
      <circle cx="1060" cy="440" r="240" fill={`url(#${id}-glow)`} />
      <g transform="translate(1060 400)">
        <path d="M-120 0 C -120 -110 120 -110 120 0 C 80 -12 40 14 0 0 C -40 14 -80 -12 -120 0Z" fill={`url(#${id}-jelly)`} />
        <g stroke="#ffb3ec" strokeOpacity="0.55" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M-80 4 C -95 80 -60 140 -85 230" />
          <path d="M-30 8 C -45 90 -10 170 -35 290" />
          <path d="M20 8 C 5 100 40 180 15 300" />
          <path d="M70 4 C 55 70 95 150 70 240" />
        </g>
      </g>
      <g transform="translate(420 610) scale(0.5)" opacity="0.8">
        <path d="M-120 0 C -120 -110 120 -110 120 0 C 80 -12 40 14 0 0 C -40 14 -80 -12 -120 0Z" fill={`url(#${id}-jelly)`} />
        <g stroke="#ffb3ec" strokeOpacity="0.5" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-50 6 C -65 90 -30 150 -55 250" />
          <path d="M40 6 C 25 90 60 150 35 250" />
        </g>
      </g>
      <path d="M0 820 C 300 780 500 800 800 830 S 1300 790 1600 820 V900 H0Z" fill="#01060c" />
    </>
  );
}

function NatureScene({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c6fa8" />
          <stop offset="0.45" stopColor="#d99aa0" />
          <stop offset="0.75" stopColor="#ffd3ad" />
          <stop offset="1" stopColor="#ffe8c9" />
        </linearGradient>
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3e6" stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff3e6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff3e6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.3" stopColor="#ffe2b8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffc59a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <circle cx="560" cy="470" r="230" fill={`url(#${id}-sun)`} />
      <path d="M0 520 L180 400 L330 470 L520 330 L700 450 L880 360 L1080 470 L1260 380 L1460 470 L1600 420 V900 H0Z" fill="#a887a8" opacity="0.7" />
      <rect y="430" width="1600" height="160" fill={`url(#${id}-fog)`} />
      <path d="M0 600 L220 470 L400 560 L620 440 L820 560 L1040 460 L1240 570 L1420 480 L1600 560 V900 H0Z" fill="#76608a" />
      <rect y="540" width="1600" height="140" fill={`url(#${id}-fog)`} opacity="0.8" />
      <path d="M0 700 L260 590 L480 670 L720 580 L960 680 L1180 600 L1400 690 L1600 630 V900 H0Z" fill="#4a3d5e" />
      <g fill="#2c2438">
        <path d="M0 900 V760 C 200 720 420 740 640 770 S 1100 730 1600 760 V900Z" />
        {[80, 150, 230, 1260, 1330, 1420, 1500].map((x, i) => (
          <path key={x} d={`M${x} ${770 - (i % 3) * 12} l-28 70 h18 l-24 50 h68 l-24 -50 h18z`} />
        ))}
      </g>
    </>
  );
}

function TechScene({ id }: { id: string }) {
  const lines = Array.from({ length: 15 }, (_, i) => i);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070a1f" />
          <stop offset="0.6" stopColor="#121a44" />
          <stop offset="1" stopColor="#1d1150" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c4f1ff" />
          <stop offset="0.25" stopColor="#6bd3ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#6b5bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-trace`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6bd3ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8be4ff" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-bg)`} />
      <g stroke="#3d5bdb" strokeOpacity="0.35" strokeWidth="1.5">
        {lines.map((i) => (
          <line key={`v${i}`} x1={800} y1={470} x2={-400 + i * 171} y2={900} />
        ))}
        {[520, 560, 620, 700, 800].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="1600" y2={y} />
        ))}
      </g>
      <rect y="0" width="1600" height="480" fill={`url(#${id}-bg)`} opacity="0.9" />
      <circle cx="800" cy="380" r="300" fill={`url(#${id}-core)`} opacity="0.55" />
      <g transform="translate(800 380) rotate(45)">
        <rect x="-110" y="-110" width="220" height="220" rx="26" fill="#0f1640" stroke="#8be4ff" strokeOpacity="0.7" strokeWidth="3" />
        <rect x="-62" y="-62" width="124" height="124" rx="14" fill="#1a2466" stroke="#c4f1ff" strokeOpacity="0.8" strokeWidth="2" />
        {[-80, -40, 0, 40, 80].map((p) => (
          <g key={p} stroke="#8be4ff" strokeOpacity="0.8" strokeWidth="4" strokeLinecap="round">
            <line x1={p} y1="-110" x2={p} y2="-140" />
            <line x1={p} y1="110" x2={p} y2="140" />
            <line x1="-110" y1={p} x2="-140" y2={p} />
            <line x1="110" y1={p} x2="140" y2={p} />
          </g>
        ))}
      </g>
      <g stroke={`url(#${id}-trace)`} strokeWidth="3" fill="none">
        <path d="M100 250 H420 L500 330 H620" />
        <path d="M1500 220 H1180 L1100 300 H980" />
        <path d="M160 560 H460 L540 480 H640" />
        <path d="M1460 590 H1150 L1070 500 H960" />
      </g>
      <path d={dotsPath(5, 60, 1600, 480, 0.8, 1.8)} fill="#c4f1ff" opacity="0.5" />
    </>
  );
}

const SCENES: Record<NicheKey, (p: { id: string }) => React.ReactElement> = {
  space: SpaceScene,
  history: HistoryScene,
  ocean: OceanScene,
  nature: NatureScene,
  tech: TechScene,
};

export function NicheScene({
  niche,
  className,
  kenBurns = false,
  title,
}: {
  niche: NicheKey;
  className?: string;
  kenBurns?: boolean;
  title?: string;
}) {
  const raw = useId();
  const id = `s${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const Scene = SCENES[niche];
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ filter: "brightness(var(--scene-dim))" }}
    >
      <g className={kenBurns ? "origin-center animate-kenburns motion-reduce:animate-none" : undefined} style={{ transformBox: "fill-box" }}>
        <Scene id={id} />
      </g>
    </svg>
  );
}

import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NicheScene } from "@/components/art/niche-scene";

const POINTS = ["Ohne Gesicht und ohne Einsprechen", "Eigenes System aus Nische und Vorbildern", "Nichts geht ohne deine Freigabe online"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Zur Startseite">
            <Logo />
          </Link>
          <ThemeToggle compact />
        </div>
        <main id="inhalt" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-center text-xs text-ink-3">
          <Link href="/impressum" className="hover:text-ink">Impressum</Link> · <Link href="/datenschutz" className="hover:text-ink">Datenschutz</Link> ·{" "}
          <Link href="/agb" className="hover:text-ink">AGB</Link> (Entwürfe)
        </p>
      </div>
      <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
        <NicheScene niche="space" kenBurns className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        <div className="absolute inset-x-12 bottom-14 text-white">
          <p className="font-display text-4xl font-bold leading-[1.05] tracking-[-0.04em]">
            Du gibst die Richtung vor.
            <br />
            <span className="serif-accent text-[1.12em] text-[#ff8a7f]">Quest übernimmt die Routine.</span>
          </p>
          <ul className="mt-6 space-y-2 text-[0.95rem] text-white/90">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-white/15">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-white/60">Beispielgrafik · Quest Agent</p>
        </div>
      </aside>
    </div>
  );
}

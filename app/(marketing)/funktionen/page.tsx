import { AudioLines, BadgeCheck, CalendarDays, Compass, Film, Smartphone, Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/marketing/page-intro";
import { Reveal } from "@/components/marketing/reveal";
import { NicheScene } from "@/components/art/niche-scene";
import { PipelineBar } from "@/components/app/bits";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata = { title: "Funktionen" };

function Row({ icon, eyebrow, title, text, points, visual, flip }: { icon: React.ReactNode; eyebrow: string; title: string; text: string; points: string[]; visual: React.ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24 [&>*]:min-w-0">
      <Reveal className={cn(flip && "lg:order-2")}>
        <p className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-coral-soft text-coral">{icon}</span>
          <span className="eyebrow">{eyebrow}</span>
        </p>
        <h2 className="mt-4 font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-[1.05] tracking-[-0.04em]">{title}</h2>
        <p className="mt-3 text-lg text-ink-2">{text}</p>
        <ul className="mt-5 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <Check className="mt-1 size-4 shrink-0 text-coral" aria-hidden /> {p}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.1} className={cn(flip && "lg:order-1")}>
        {visual}
      </Reveal>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Funktionen"
        title={
          <>
            Alles, was ein Faceless-Kanal <span className="serif-accent text-coral">braucht.</span>
          </>
        }
        text="Von der Nische bis zum geplanten Upload – mit dir an genau den Stellen, an denen es auf dich ankommt."
      />

      <Row
        icon={<Compass className="size-5" />}
        eyebrow="Nische & Vorbilder"
        title="Dein System, nicht irgendein Template."
        text="Nische, Zielgruppe, Themen und Referenzkanäle bestimmen, was Quest vorschlägt. Mehrere Systeme laufen getrennt nebeneinander."
        points={["Kanal-Links, @Handles und Kanal-IDs werden geprüft", "Vorbilder liefern Stil-Signale – kopiert wird nichts", "Jedes System mit eigener Stimme, Menge und Zeitplan"]}
        visual={
          <div className="card-float space-y-2.5 p-5">
            {["@beispiel-kosmos", "youtube.com/@wissen-in-10", "youtube.com/watch?v=…"].map((r, i) => (
              <div key={r} className={cn("flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm", i === 2 ? "border-coral/50 bg-coral-soft/50" : "border-line bg-surface-2")}>
                <span className="font-medium">{r}</span>
                <span className={cn("text-xs font-semibold", i === 2 ? "text-coral-ink" : "text-ok-ink")}>{i === 2 ? "Video-Link – bitte Kanal angeben" : "✓ Kanal erkannt"}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-ink-3">Beispielhafte Eingaben</p>
          </div>
        }
      />

      <Row
        flip
        icon={<Film className="size-5" />}
        eyebrow="Automatisierte Produktion"
        title="Recherche bis Schnitt – ohne dass du einen Finger rührst."
        text="Ein Worker arbeitet die Schritte nacheinander ab, speichert jeden Zwischenstand und macht nach einer Unterbrechung dort weiter."
        points={["Nachvollziehbarer Status für jeden Auftrag", "Technische Fehler werden begrenzt automatisch wiederholt", "Kein doppelter Verbrauch deines Kontingents"]}
        visual={
          <div className="card-float space-y-5 p-6">
            {(["rendering", "awaiting_approval", "scheduled"] as const).map((s, i) => (
              <div key={s}>
                <p className="mb-2 text-sm font-semibold">{["Was lebt in 4.000 Metern Tiefe?", "Der Wald, der miteinander spricht", "Wie ein Chip in Nanosekunden denkt"][i]}</p>
                <PipelineBar status={s} />
              </div>
            ))}
          </div>
        }
      />

      <Row
        icon={<AudioLines className="size-5" />}
        eyebrow="KI-Stimme"
        title="Du sprichst nichts ein."
        text="Eine KI-Stimme spricht deine Skripte – passend zu Ton und Format. Im Live-Betrieb aus der konfigurierten ElevenLabs-Auswahl."
        points={["Stimme pro System wählbar", "Hörproben vor der Auswahl", "Skript-Änderungen lösen eine neue Vertonung aus"]}
        visual={
          <div className="card-float p-6">
            <div className="flex h-24 items-center justify-center gap-1 overflow-hidden sm:gap-1.5">
              {Array.from({ length: 28 }, (_, i) => (
                <span key={i} className="w-1 shrink-0 origin-center animate-wave sm:w-1.5 rounded-full bg-coral motion-reduce:animate-none" style={{ height: `${25 + ((i * 53) % 75)}%`, animationDelay: `${(i % 8) * 0.08}s` }} />
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-ink-3">Stimm-Visualisierung (dekorativ)</p>
          </div>
        }
      />

      <Row
        flip
        icon={<Smartphone className="size-5" />}
        eyebrow="Shorts"
        title="Hochkant-Clips aus denselben Themen."
        text="Shorts bekommen einen eigenen Rhythmus und ein eigenes Kontingent – geplant getrennt von deinen Videos."
        points={["Eigene Slots für Shorts", "Eigene Länge (vorläufig bis 60 Sek.)", "Gemeinsame Freigabe-Inbox"]}
        visual={
          <div className="flex justify-center gap-4">
            {(["ocean", "tech", "nature"] as const).map((n, i) => (
              <div key={n} className={cn("relative aspect-[9/16] w-1/4 overflow-hidden rounded-2xl border-[3px] border-surface shadow-[0_30px_60px_-30px_rgb(var(--shadow-color)/0.6)]", i === 1 && "-translate-y-6")}>
                <NicheScene niche={n} kenBurns className="absolute inset-0" />
              </div>
            ))}
          </div>
        }
      />

      <Row
        icon={<BadgeCheck className="size-5" />}
        eyebrow="Freigabe"
        title="Prüfen, ändern, freigeben."
        text="Video, Shorts, Titel, Beschreibung, Thumbnail-Entwurf, Skript und Quellen an einem Ort. Jede Änderung ist eine neue Version."
        points={["Freigabe gilt für genau eine Version", "Automatische Prüfung und Rechtestatus getrennt", "Änderungen anfordern oder verwerfen"]}
        visual={
          <div className="card-float space-y-3 p-5">
            <div className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok-ink">
              <ShieldCheck className="size-4" /> Automatische Prüfung: 7 von 8 ok, 1 Hinweis
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              <ShieldAlert className="size-4" /> Rechte: 1 Clip mit unbekannter Lizenz
            </div>
            <div className="flex gap-2 pt-2">
              <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ok font-semibold text-white">
                <Check className="size-4" /> Freigeben & einplanen
              </span>
              <span className="inline-flex h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold">Ändern</span>
            </div>
            <p className="text-xs text-ink-3">Darstellung vereinfacht</p>
          </div>
        }
      />

      <Row
        flip
        icon={<CalendarDays className="size-5" />}
        eyebrow="Kalender"
        title="Dein Rhythmus – auch über die Zeitumstellung."
        text="Wochentage, Uhrzeiten, Zeitzone: gespeichert in UTC, angezeigt in deiner Zeit. Verpasste Termine ohne Freigabe werden nie automatisch veröffentlicht."
        points={["Videos und Shorts getrennt planbar", "Termine ändern, Slots ergänzen", "Sommer-/Winterzeit wird erkannt und erklärt"]}
        visual={
          <div className="card-float p-5">
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
                <div key={d}>
                  <p className="mb-1.5 font-semibold text-ink-3">{d}</p>
                  <div className="flex h-24 flex-col gap-1 rounded-lg border border-line bg-surface-2 p-1">
                    {[0, 2, 4].includes(i) && <span className="rounded bg-violet-soft px-1 py-1 text-[0.62rem] font-semibold text-violet">18:00</span>}
                    {[1, 3, 5].includes(i) && <span className="rounded bg-coral-soft px-1 py-1 text-[0.62rem] font-semibold text-coral-ink">12:00</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <div className="rounded-[2rem] border border-dashed border-line-strong bg-surface-2 p-7">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">Transparenz: Was in dieser Version simuliert ist</h2>
          <p className="mt-2 text-ink-2">
            Kundenbereich, Datenbank, Worker, Freigaben, Kalender und Kontingente laufen echt. Recherche, KI-Stimme, Schnitt, YouTube-Upload und Zahlung sind vorbereitet, in der
            Demo aber simuliert und so gekennzeichnet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/demo">Demo öffnen</ButtonLink>
            <ButtonLink href="/registrieren" variant="secondary">
              Eigenes System erstellen
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

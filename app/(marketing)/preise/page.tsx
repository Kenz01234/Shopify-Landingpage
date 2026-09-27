import Link from "next/link";
import { Pricing } from "@/components/marketing/sections/pricing";
import { FaqList } from "@/components/marketing/sections/faq";
import { PageIntro } from "@/components/marketing/page-intro";
import { PLANS, ASSUMPTIONS } from "@/lib/plans";

export const metadata = { title: "Preise" };

const ROWS: [string, string, string][] = [
  ["Monatspreis (Vorschlag)", `${PLANS.starter.priceEurMonthly} €`, `${PLANS.studio.priceEurMonthly} €`],
  ["Longform-Videos pro Abrechnungszeitraum", `${PLANS.starter.longformPerPeriod}`, `${PLANS.studio.longformPerPeriod}`],
  ["Maximale Länge pro Video", `${PLANS.starter.longformMaxMinutes} Min.`, `${PLANS.studio.longformMaxMinutes} Min.`],
  ["Shorts pro Abrechnungszeitraum", `${PLANS.starter.shortsPerPeriod}`, `${PLANS.studio.shortsPerPeriod}`],
  ["Länge pro Short (Annahme)", `bis ${ASSUMPTIONS.shortMaxSeconds} Sek.`, `bis ${ASSUMPTIONS.shortMaxSeconds} Sek.`],
  ["KI-Stimme, Freigabe-Inbox, Kalender, Medien", "✓", "✓"],
  ["Überarbeitungen pro Auftrag (Annahme)", `${ASSUMPTIONS.maxRevisionsPerJob}`, `${ASSUMPTIONS.maxRevisionsPerJob}`],
];

export default function PricingPage() {
  return (
    <>
      <PageIntro eyebrow="Preise" title={<>Zwei Pläne. <span className="serif-accent text-coral">Klare Mengen.</span></>} text="Du zahlst für ein festes monatliches Produktionskontingent – nicht für Versprechen." />
      <Pricing showHeader={false} />
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6" aria-labelledby="cmp">
        <h2 id="cmp" className="font-display text-3xl font-bold tracking-[-0.04em]">Im Vergleich</h2>
        <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-3">
                <th className="px-5 py-4 font-medium">Leistung</th>
                <th className="px-5 py-4 font-semibold text-ink">Starter</th>
                <th className="px-5 py-4 font-semibold text-ink">Studio</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 text-ink-2">{a}</td>
                  <td className="px-5 py-3.5 font-medium tabular-nums">{b}</td>
                  <td className="px-5 py-3.5 font-medium tabular-nums">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-ink-3">
          Offen und noch nicht festgelegt: Steuerdarstellung, Kanal-/Systemanzahl, Wartezeiten, Übertragbarkeit ungenutzter Mengen, Kündigungsfristen. Details in den{" "}
          <Link href="/agb" className="underline">AGB-Entwürfen</Link>.
        </p>
        <h2 className="mt-16 font-display text-3xl font-bold tracking-[-0.04em]">Fragen zum Abo</h2>
        <div className="mt-6">
          <FaqList
            items={[
              { q: "Werden ungenutzte Videos übertragen?", a: "Vorläufige Annahme: nein. Kontingente gelten je Abrechnungszeitraum, der sich an deinem Abo-Beginn orientiert – nicht am Kalendermonat. Die endgültige Regel steht noch aus." },
              { q: "Was passiert bei einem Planwechsel?", a: "Ein Upgrade gilt sofort und hebt das Kontingent im laufenden Zeitraum an. Ein Wechsel auf den kleineren Plan wird zum Ende des Abrechnungszeitraums wirksam." },
              { q: "Wie kündige ich?", a: "Im Kundenbereich unter „Abo“ – zum Ende des laufenden Zeitraums. Bis dahin läuft alles weiter; die Kündigung kannst du bis dahin zurücknehmen." },
              { q: "Wird in der Demo etwas abgebucht?", a: "Nein. Die Demo nutzt ein simuliertes Billing. Echte Zahlungen sind vorbereitet (Stripe), aber in dieser Version nicht aktiv." },
            ]}
          />
        </div>
      </section>
    </>
  );
}

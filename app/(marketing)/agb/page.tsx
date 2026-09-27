import { LegalDraft, Missing } from "@/components/marketing/legal-draft";
import { PLANS, ASSUMPTIONS } from "@/lib/plans";

export const metadata = { title: "AGB (Entwurf)" };

export default function TermsPage() {
  return (
    <LegalDraft title="Allgemeine Geschäftsbedingungen">
      <h2>Leistung</h2>
      <p>
        Quest Agent stellt ein Software-System zur Produktion und Planung von Inhalten für YouTube-Kanäle bereit. Veröffentlicht wird ausschließlich nach ausdrücklicher Freigabe
        durch die Kundin bzw. den Kunden. Es werden keine Reichweiten, Einnahmen oder Zulassungen zu Partnerprogrammen zugesagt.
      </p>
      <h2>Pläne (vorläufig)</h2>
      <p>
        Starter {PLANS.starter.priceEurMonthly} €/Monat ({PLANS.starter.longformPerPeriod} Videos à {PLANS.starter.longformMaxMinutes} Min., {PLANS.starter.shortsPerPeriod} Shorts), Studio{" "}
        {PLANS.studio.priceEurMonthly} €/Monat ({PLANS.studio.longformPerPeriod} Videos à {PLANS.studio.longformMaxMinutes} Min., {PLANS.studio.shortsPerPeriod} Shorts). Steuerdarstellung:{" "}
        <Missing>Brutto/Netto-Angabe</Missing>
      </p>
      <h2>Kontingente</h2>
      <p>
        Kontingente gelten je Abrechnungszeitraum ab Abo-Beginn. Vorläufige Annahmen: max. {ASSUMPTIONS.maxRevisionsPerJob} Überarbeitungen pro Auftrag, keine Übertragung ungenutzter
        Mengen. Endgültige Regelung: <Missing>Entscheidung</Missing>
      </p>
      <h2>Laufzeit und Kündigung</h2>
      <p>
        <Missing>Mindestlaufzeit, Kündigungsfrist, Verlängerung</Missing>
      </p>
      <h2>Rechte an Inhalten</h2>
      <p>
        <Missing>Nutzungsrechte an erzeugten Inhalten, Verantwortung für Quellen und Material, KI-Kennzeichnung</Missing>
      </p>
      <h2>Haftung</h2>
      <p>
        <Missing>rechtlich geprüfte Formulierung</Missing>
      </p>
    </LegalDraft>
  );
}

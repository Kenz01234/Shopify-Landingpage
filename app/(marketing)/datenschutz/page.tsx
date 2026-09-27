import { LegalDraft, Missing } from "@/components/marketing/legal-draft";

export const metadata = { title: "Datenschutz (Entwurf)" };

export default function PrivacyPage() {
  return (
    <LegalDraft title="Datenschutzhinweise">
      <h2>Verantwortlicher</h2>
      <p>
        <Missing>Name und Anschrift des Verantwortlichen, Kontakt Datenschutz</Missing>
      </p>
      <h2>Welche Daten verarbeitet werden (technischer Stand dieser Version)</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Konto: Name, E-Mail-Adresse, Passwort (als sicherer Hash), Sitzungen (HttpOnly-Cookie).</li>
        <li>Systeme und Inhalte: Nische, Referenzkanäle, Zeitpläne, Aufträge, Inhaltsversionen, Freigaben, Medien.</li>
        <li>Kontaktformular: Name, E-Mail-Adresse, Nachricht.</li>
        <li>Technische Protokolle: Audit-Ereignisse zu Aktionen im Kundenbereich.</li>
        <li>Anzeige-Einstellung (hell/dunkel) wird nur lokal im Browser gespeichert.</li>
      </ul>
      <h2>Externe Dienste (im Live-Betrieb, derzeit nicht aktiv)</h2>
      <p>
        Vorgesehen sind u. a. n8n (Produktion), ElevenLabs (KI-Stimme), Google/YouTube (Upload) und Stripe (Zahlung). Rechtsgrundlagen, Auftragsverarbeitung, Drittlandübermittlung
        und Speicherdauern: <Missing>rechtliche Prüfung und Ergänzung</Missing>
      </p>
      <h2>Schriftarten</h2>
      <p>Schriften werden lokal vom eigenen Server ausgeliefert, nicht von Drittanbietern.</p>
      <h2>Rechte der betroffenen Personen</h2>
      <p>
        <Missing>Auskunft, Berichtigung, Löschung, Widerspruch, Beschwerderecht – vollständige Formulierung</Missing>
      </p>
    </LegalDraft>
  );
}

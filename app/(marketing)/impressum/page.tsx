import { LegalDraft, Missing } from "@/components/marketing/legal-draft";

export const metadata = { title: "Impressum (Entwurf)" };

export default function ImprintPage() {
  return (
    <LegalDraft title="Impressum">
      <h2>Angaben zum Anbieter</h2>
      <p>
        <Missing>Firmenname und Rechtsform</Missing>
        <br />
        <Missing>Anschrift</Missing>
        <br />
        <Missing>Vertretungsberechtigte Person(en)</Missing>
      </p>
      <h2>Kontakt</h2>
      <p>
        E-Mail: <Missing>E-Mail-Adresse</Missing>
        <br />
        Telefon: <Missing>Telefonnummer</Missing>
      </p>
      <h2>Register und Steuern</h2>
      <p>
        Registergericht/Registernummer: <Missing>falls vorhanden</Missing>
        <br />
        USt-IdNr.: <Missing>falls vorhanden</Missing>
      </p>
      <h2>Hinweis</h2>
      <p>Quest Agent ist ein unabhängiges Produkt und steht in keiner Verbindung zu YouTube oder Google.</p>
    </LegalDraft>
  );
}

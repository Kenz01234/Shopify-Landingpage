import { PageIntro } from "@/components/marketing/page-intro";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata = { title: "Kontakt" };

export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Kontakt" title={<>Schreib <span className="serif-accent text-coral">uns.</span></>} text="Fragen zu Quest Agent, Demo-Wünsche oder Partnerschaften." />
      <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ContactForm />
        <aside className="space-y-4 text-sm text-ink-2">
          <div className="rounded-3xl border border-line bg-surface-2 p-6">
            <p className="font-semibold text-ink">So geht es weiter</p>
            <p className="mt-2">Deine Nachricht wird gespeichert und im Admin-Bereich angezeigt. In dieser Vorschau wird keine E-Mail versendet.</p>
          </div>
          <div className="rounded-3xl border border-dashed border-line-strong p-6">
            <p className="font-semibold text-ink">Unternehmensangaben</p>
            <p className="mt-2">Anschrift, E-Mail und Telefonnummer werden ergänzt, sobald die Unternehmensdaten feststehen.</p>
          </div>
        </aside>
      </section>
    </>
  );
}

import { FaqList } from "@/components/marketing/sections/faq";
import { PageIntro } from "@/components/marketing/page-intro";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <>
      <PageIntro eyebrow="FAQ" title={<>Ehrliche <span className="serif-accent text-coral">Antworten.</span></>} text="Was du selbst tust, wie Freigabe und Planung funktionieren – und was wir nicht versprechen." />
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <FaqList />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/registrieren">Eigenes System erstellen</ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary">
            Andere Frage? Kontakt
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

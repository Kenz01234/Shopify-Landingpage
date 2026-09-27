import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLS = [
  {
    title: "Produkt",
    links: [
      { href: "/#loop", label: "So läuft’s" },
      { href: "/funktionen", label: "Funktionen" },
      { href: "/preise", label: "Preise" },
      { href: "/faq", label: "FAQ" },
      { href: "/demo", label: "Demo öffnen" },
    ],
  },
  {
    title: "Konto",
    links: [
      { href: "/registrieren", label: "Registrieren" },
      { href: "/login", label: "Anmelden" },
      { href: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Rechtliches (Entwurf)",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line bg-surface-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-ink-3">
            Der rote Faden für deinen Faceless-Kanal: Quest produziert, du gibst frei.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold text-ink">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-3 transition hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            Quest Agent ist ein unabhängiges Produkt und steht in keiner Verbindung zu YouTube oder Google. YouTube ist eine Marke
            der Google LLC.
          </p>
          <p className="shrink-0">Vorschauversion · Unternehmensangaben unvollständig</p>
        </div>
      </div>
    </footer>
  );
}

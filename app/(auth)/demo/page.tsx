import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { DemoLogin } from "@/components/auth/demo-login";

export const metadata = { title: "Demo öffnen" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  if (!isDemoMode()) notFound();
  return (
    <>
      <p className="eyebrow">Lokaler Demo-Modus</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">Quest Agent ausprobieren</h1>
      <p className="mt-2 text-ink-3">
        Die Demo nutzt ein echtes Backend mit Datenbank und Worker. Recherche, Stimme, Produktion, Upload und Zahlung werden dabei sichtbar simuliert.
      </p>
      <DemoLogin />
      <p className="mt-6 text-sm text-ink-3">
        Lieber mit leerem Konto starten?{" "}
        <Link href="/registrieren" className="font-semibold text-coral-ink hover:underline">
          Eigenes Konto registrieren
        </Link>
      </p>
    </>
  );
}

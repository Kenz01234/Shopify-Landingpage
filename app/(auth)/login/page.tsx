import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const { weiter } = await searchParams;
  const safeNext = weiter && weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/app";
  if (await getViewer()) redirect(safeNext);
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-[-0.04em]">Willkommen zurück</h1>
      <p className="mt-2 text-ink-3">Melde dich an, um Freigaben zu prüfen und deinen Loop zu steuern.</p>
      <LoginForm next={safeNext} />
      <p className="mt-6 text-sm text-ink-3">
        Noch kein Konto?{" "}
        <Link href="/registrieren" className="font-semibold text-coral-ink hover:underline">
          Eigenes System erstellen
        </Link>
        {isDemoMode() && (
          <>
            {" "}
            oder{" "}
            <Link href="/demo" className="font-semibold text-coral-ink hover:underline">
              Demo öffnen
            </Link>
          </>
        )}
      </p>
    </>
  );
}

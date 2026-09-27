import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { RegisterForm } from "@/components/auth/register-form";
import { PLANS, type PlanKey } from "@/lib/plans";

export const metadata = { title: "Registrieren" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const planKey: PlanKey | null = plan === "starter" || plan === "studio" ? plan : null;
  if (await getViewer()) redirect(planKey ? `/app/abo?plan=${planKey}` : "/app");
  return (
    <>
      <p className="eyebrow">Schritt 1 von 3 · Konto</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">Eigenes System erstellen</h1>
      <p className="mt-2 text-ink-3">
        Konto anlegen, {planKey ? <strong className="text-ink">{PLANS[planKey].name}-Plan</strong> : "Plan"} bestätigen, System einrichten. Dauert
        etwa fünf Minuten.
      </p>
      <RegisterForm plan={planKey} />
      <p className="mt-6 text-sm text-ink-3">
        Schon registriert?{" "}
        <Link href="/login" className="font-semibold text-coral-ink hover:underline">
          Anmelden
        </Link>
      </p>
    </>
  );
}

import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { quotaSummary } from "@/lib/quota";
import { orgNow } from "@/lib/clock";
import { PageHeader } from "@/components/ui/misc";
import { BillingPanel } from "@/components/app/billing-panel";

export const metadata = { title: "Abo" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; start?: string; weiter?: string; checkout?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: viewer.org.id }, include: { subscription: true } });
  const sub = org.subscription;
  const quota = await quotaSummary(org.id, sub);
  const systemsCount = await prisma.channelSystem.count({ where: { organizationId: org.id, status: { not: "archived" } } });
  const preselect = sp.plan === "starter" || sp.plan === "studio" ? sp.plan : null;
  return (
    <>
      <PageHeader
        eyebrow={!sub || sub.status === "canceled" ? <span className="eyebrow">Schritt 2 von 3 · Plan bestätigen</span> : undefined}
        title={!sub || sub.status === "canceled" ? "Plan wählen" : "Abo & Kontingent"}
        description={
          !sub || sub.status === "canceled"
            ? "Wähle den Plan für dein erstes System. Danach richtest du Nische, Vorbilder und Uploadplan ein."
            : "Aktueller Plan, Abrechnungszeitraum, Verbrauch und reservierte Mengen."
        }
      />
      <BillingPanel
        provider={env().BILLING_PROVIDER}
        demo={isDemoMode()}
        preselect={preselect}
        checkoutState={sp.checkout ?? null}
        hasSystems={systemsCount > 0}
        now={orgNow(org).toISOString()}
        subscription={
          sub
            ? {
                plan: sub.plan,
                status: sub.status,
                provider: sub.provider,
                currentPeriodStart: sub.currentPeriodStart.toISOString(),
                currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                pendingPlan: sub.pendingPlan,
                demoFailNextRenewal: sub.demoFailNextRenewal,
              }
            : null
        }
        quota={
          quota
            ? { longform: quota.longform, short: quota.short, periodStart: quota.periodStart.toISOString(), periodEnd: quota.periodEnd.toISOString() }
            : null
        }
      />
    </>
  );
}

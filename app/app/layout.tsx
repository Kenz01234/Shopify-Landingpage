import { AppShell } from "@/components/app/app-shell";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { REVIEW_STATUSES } from "@/lib/jobs/state";
import { PLANS } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_DE } from "@/lib/billing/subscription";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const [sub, review] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: viewer.org.id } }),
    prisma.productionJob.count({ where: { organizationId: viewer.org.id, status: { in: REVIEW_STATUSES } } }),
  ]);
  return (
    <AppShell
      user={{ name: viewer.user.name, email: viewer.user.email, isAdmin: viewer.user.platformRole === "admin" }}
      orgName={viewer.org.name}
      plan={sub ? { name: PLANS[sub.plan].name, status: SUBSCRIPTION_STATUS_DE[sub.status] } : null}
      demo={{ enabled: isDemoMode(), clockOffsetMinutes: viewer.org.demoClockOffsetMinutes }}
      initialReview={review}
    >
      {children}
    </AppShell>
  );
}

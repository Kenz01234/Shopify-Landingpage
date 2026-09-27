import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader, Card, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge, FormatTag } from "@/components/app/bits";
import { AdminRetryButton, DemoResetPanel } from "@/components/app/admin-actions";
import { PLANS, ASSUMPTIONS } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_DE } from "@/lib/billing/subscription";
import { isDemoMode, env } from "@/lib/env";
import { workerStatus } from "@/lib/queries";
import { formatDateTimeDe } from "@/lib/time";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [orgs, systemsCount, jobsByStatus, failed, webhooks, contacts, worker] = await Promise.all([
    prisma.organization.findMany({
      include: { subscription: true, _count: { select: { systems: true, jobs: true } }, memberships: { include: { user: { select: { email: true } } }, take: 1 } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.channelSystem.count({ where: { status: { not: "archived" } } }),
    prisma.productionJob.groupBy({ by: ["status"], _count: true }),
    prisma.productionJob.findMany({ where: { status: "failed" }, include: { system: { select: { name: true } }, organization: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 8 }),
    prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    workerStatus(),
  ]);
  const count = (s: string) => jobsByStatus.find((j) => j.status === s)?._count ?? 0;
  const e = env();
  return (
    <>
      <PageHeader title="Admin" description="Kunden, Systeme und Aufträge im Überblick. Fehlgeschlagene Aufträge lassen sich kontrolliert wiederholen." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Kunden" value={orgs.length} />
        <Stat label="Aktive Systeme" value={systemsCount} />
        <Stat label="Warten auf Freigabe" value={count("awaiting_approval") + count("awaiting_topic_approval") + count("awaiting_script_approval")} />
        <Stat label="Fehlgeschlagen" value={count("failed")} />
        <Stat label="Worker" value={worker.alive ? "aktiv" : "aus"} sub={worker.lastBeatAt ? `Herzschlag ${formatDateTimeDe(worker.lastBeatAt, "Europe/Berlin", "HH:mm:ss")}` : "nie"} />
      </div>

      <Card className="mt-6 overflow-x-auto">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Kunden</h2>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Organisation</th>
              <th className="py-2 pr-3 font-medium">Kontakt</th>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Systeme</th>
              <th className="py-2 pr-3 font-medium">Aufträge</th>
              <th className="py-2 font-medium">Seit</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3 font-medium">
                  {o.name} {o.isDemo && <Badge tone="demo">Demo</Badge>}
                </td>
                <td className="py-2.5 pr-3 text-ink-3">{o.memberships[0]?.user.email}</td>
                <td className="py-2.5 pr-3">{o.subscription ? `${PLANS[o.subscription.plan].name} · ${SUBSCRIPTION_STATUS_DE[o.subscription.status]}` : "–"}</td>
                <td className="py-2.5 pr-3 tabular-nums">{o._count.systems}</td>
                <td className="py-2.5 pr-3 tabular-nums">{o._count.jobs}</td>
                <td className="py-2.5 text-ink-3">{formatDateTimeDe(o.createdAt, "Europe/Berlin", "d. LLL yyyy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Fehlgeschlagene Aufträge</h2>
        {failed.length === 0 ? (
          <p className="text-sm text-ink-3">Keine.</p>
        ) : (
          <ul className="divide-y divide-line">
            {failed.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {j.organization.name} · {j.system.name}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                    <FormatTag format={j.format} /> {j.lastErrorCode}: {j.lastErrorMessage}
                  </p>
                </div>
                <JobStatusBadge status={j.status} />
                <AdminRetryButton jobId={j.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Webhook-Ereignisse</h2>
          {webhooks.length === 0 ? (
            <p className="text-sm text-ink-3">Noch keine (Demo-Modus nutzt keine externen Webhooks).</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {webhooks.map((w) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span>
                    {w.provider} · {w.eventType}
                  </span>
                  <Badge tone={w.status === "processed" ? "ok" : w.status === "failed" ? "error" : "neutral"}>{w.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Kontaktanfragen</h2>
          {contacts.length === 0 ? (
            <p className="text-sm text-ink-3">Keine.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">
                    {c.name} · {c.topic}
                  </p>
                  <p className="line-clamp-2 text-ink-3">{c.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-[-0.02em]">Konfiguration & Annahmen</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Produktion</dt><dd>{e.PRODUCTION_PROVIDER}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Stimme</dt><dd>{e.VOICE_PROVIDER}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Veröffentlichung</dt><dd>{e.PUBLISH_PROVIDER}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Billing</dt><dd>{e.BILLING_PROVIDER}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Starter</dt><dd>{PLANS.starter.priceEurMonthly} € · {PLANS.starter.longformPerPeriod}×{PLANS.starter.longformMaxMinutes} Min · {PLANS.starter.shortsPerPeriod} Shorts</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Studio</dt><dd>{PLANS.studio.priceEurMonthly} € · {PLANS.studio.longformPerPeriod}×{PLANS.studio.longformMaxMinutes} Min · {PLANS.studio.shortsPerPeriod} Shorts</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Max. Short-Länge (Annahme)</dt><dd>{ASSUMPTIONS.shortMaxSeconds} s</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Überarbeitungen pro Auftrag (Annahme)</dt><dd>{ASSUMPTIONS.maxRevisionsPerJob}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Systeme pro Konto (Annahme)</dt><dd>{ASSUMPTIONS.maxSystemsPerOrg}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-3">Übertrag ungenutzter Mengen</dt><dd>{ASSUMPTIONS.unusedQuotaCarriesOver ? "ja" : "nein (Annahme)"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">Details: docs/ANNAHMEN.md – keine endgültigen Konditionen.</p>
      </Card>

      {isDemoMode() && <DemoResetPanel />}
    </>
  );
}

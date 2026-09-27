import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, InlineAlert } from "@/components/ui/misc";
import { SystemWizard } from "@/components/app/wizard/system-wizard";
import { allocationUsedByOthers } from "@/lib/systems";

export const metadata = { title: "System bearbeiten" };

export default async function EditSystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const system = await prisma.channelSystem.findFirst({
    where: { id, organizationId: viewer.org.id },
    include: { referenceChannels: { orderBy: { createdAt: "asc" } }, slots: true },
  });
  if (!system || system.status === "archived") notFound();
  const sub = await prisma.subscription.findUnique({ where: { organizationId: viewer.org.id } });
  const used = await allocationUsedByOthers(prisma, viewer.org.id, system.id);
  return (
    <>
      <PageHeader title={`${system.name} bearbeiten`} back={{ href: `/app/systeme/${system.id}`, label: system.name }} />
      <InlineAlert tone="info" className="mb-6">
        Änderungen gelten für neue Aufträge. Laufende Aufträge behalten ihren Konfigurations-Snapshot (aktuell Version {system.configVersion}); bereits freigegebene Termine bleiben bestehen.
      </InlineAlert>
      <SystemWizard
        mode="edit"
        systemId={system.id}
        plan={sub?.plan ?? "starter"}
        usedByOthers={used}
        initial={{
          name: system.name,
          niche: system.niche,
          topics: system.topics,
          audience: system.audience,
          language: system.language as "de",
          referenceChannels: system.referenceChannels.map((r) => r.input),
          tone: system.tone,
          style: system.style,
          voiceKey: system.voiceKey,
          longformEnabled: system.longformEnabled,
          shortsEnabled: system.shortsEnabled,
          shortPlatforms: system.shortPlatforms,
          longformPerPeriod: system.longformPerPeriod,
          longformMinutes: system.longformMinutes,
          shortsPerPeriod: system.shortsPerPeriod,
          shortSeconds: system.shortSeconds,
          timezone: system.timezone,
          slots: system.slots.map((s) => ({ format: s.format, weekday: s.weekday, localTime: s.localTime })),
          reviewMode: system.reviewMode,
        }}
      />
    </>
  );
}

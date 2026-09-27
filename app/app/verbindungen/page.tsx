import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { PLATFORM_KEYS, PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { PageHeader, InlineAlert } from "@/components/ui/misc";
import { ConnectionCards } from "@/components/app/connection-cards";
import { CONNECTORS, platformPublishMode } from "@/providers";

export const metadata = { title: "Verbindungen" };

const MSG: Record<string, { tone: "ok" | "error" | "warn"; text: (label: string) => string }> = {
  verbunden: { tone: "ok", text: (l) => `${l} verbunden.` },
  abgelehnt: { tone: "warn", text: (l) => `Die Verbindung wurde bei ${l} abgelehnt.` },
  ungueltig: { tone: "error", text: () => "Ungültige oder abgelaufene Anfrage. Bitte erneut verbinden." },
  fehler: { tone: "error", text: () => "Verbindung fehlgeschlagen. Bitte später erneut versuchen." },
  "nicht-konfiguriert": { tone: "warn", text: (l) => `Die ${l}-Anbindung ist vom Betreiber noch nicht eingerichtet.` },
};

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ plattform?: string; status?: string }> }) {
  const { plattform, status } = await searchParams;
  const viewer = await requireViewer();
  const e = env();
  const [connections, lastAccepted] = await Promise.all([
    prisma.providerConnection.findMany({ where: { organizationId: viewer.org.id, provider: { in: PLATFORM_KEYS } } }),
    prisma.productionJob.findFirst({ where: { organizationId: viewer.org.id, externalAcceptedAt: { not: null } }, orderBy: { externalAcceptedAt: "desc" }, select: { externalAcceptedAt: true } }),
  ]);
  const label = plattform && (PLATFORM_KEYS as string[]).includes(plattform) ? PLATFORMS[plattform as PlatformKey].label : null;
  const msg = label && status ? MSG[status] : null;
  return (
    <>
      <PageHeader
        title="Verbindungen"
        description="Hier siehst du ehrlich, was verbunden ist, was simuliert wird und was noch fehlt. Zugangsdaten des Betreibers werden nie im Browser angezeigt."
      />
      {msg && label && (
        <InlineAlert tone={msg.tone} className="mb-6">
          {msg.text(label)}
        </InlineAlert>
      )}
      <ConnectionCards
        demo={isDemoMode()}
        platforms={PLATFORM_KEYS.map((platform) => {
          const c = connections.find((x) => x.provider === platform);
          return {
            platform,
            publishMode: platformPublishMode(platform),
            configured: CONNECTORS[platform].configured(),
            status: c?.status ?? "not_connected",
            displayName: c?.displayName ?? null,
            lastError: c?.lastError ?? null,
          };
        })}
        n8n={{ mode: e.PRODUCTION_PROVIDER, configured: !!(e.N8N_JOB_WEBHOOK_URL && e.N8N_SHARED_SECRET), lastAcceptedAt: lastAccepted?.externalAcceptedAt?.toISOString() ?? null }}
        elevenlabs={{ mode: e.VOICE_PROVIDER, configured: !!e.ELEVENLABS_API_KEY }}
      />
    </>
  );
}

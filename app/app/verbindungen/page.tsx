import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { PageHeader, InlineAlert } from "@/components/ui/misc";
import { ConnectionCards } from "@/components/app/connection-cards";
import { youtubeConfigured } from "@/providers/youtube";

export const metadata = { title: "Verbindungen" };

const YT_MSG: Record<string, { tone: "ok" | "error" | "warn"; text: string }> = {
  verbunden: { tone: "ok", text: "YouTube-Kanal verbunden." },
  abgelehnt: { tone: "warn", text: "Die Verbindung wurde bei Google abgelehnt." },
  ungueltig: { tone: "error", text: "Ungültige oder abgelaufene Anfrage. Bitte erneut verbinden." },
  fehler: { tone: "error", text: "Verbindung fehlgeschlagen. Bitte später erneut versuchen." },
  "nicht-konfiguriert": { tone: "warn", text: "Die YouTube-Anbindung ist vom Betreiber noch nicht eingerichtet." },
};

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ youtube?: string }> }) {
  const { youtube } = await searchParams;
  const viewer = await requireViewer();
  const e = env();
  const [yt, lastAccepted] = await Promise.all([
    prisma.providerConnection.findUnique({ where: { organizationId_provider: { organizationId: viewer.org.id, provider: "youtube" } } }),
    prisma.productionJob.findFirst({ where: { organizationId: viewer.org.id, externalAcceptedAt: { not: null } }, orderBy: { externalAcceptedAt: "desc" }, select: { externalAcceptedAt: true } }),
  ]);
  const msg = youtube ? YT_MSG[youtube] : null;
  return (
    <>
      <PageHeader
        title="Verbindungen"
        description="Hier siehst du ehrlich, was verbunden ist, was simuliert wird und was noch fehlt. Zugangsdaten des Betreibers werden nie im Browser angezeigt."
      />
      {msg && (
        <InlineAlert tone={msg.tone} className="mb-6">
          {msg.text}
        </InlineAlert>
      )}
      <ConnectionCards
        demo={isDemoMode()}
        youtube={{
          publishMode: e.PUBLISH_PROVIDER,
          oauthConfigured: youtubeConfigured(),
          status: yt?.status ?? "not_connected",
          mode: yt?.mode ?? null,
          displayName: yt?.displayName ?? null,
          scopes: yt?.scopes ?? [],
          tokenExpiresAt: yt?.tokenExpiresAt?.toISOString() ?? null,
          lastError: yt?.lastError ?? null,
        }}
        n8n={{ mode: e.PRODUCTION_PROVIDER, configured: !!(e.N8N_JOB_WEBHOOK_URL && e.N8N_SHARED_SECRET), lastAcceptedAt: lastAccepted?.externalAcceptedAt?.toISOString() ?? null }}
        elevenlabs={{ mode: e.VOICE_PROVIDER, configured: !!e.ELEVENLABS_API_KEY }}
      />
    </>
  );
}

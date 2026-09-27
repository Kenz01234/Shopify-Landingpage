import { env } from "@/lib/env";
import { loadTokens, markRevoked, saveTokens } from "@/providers/connection-tokens";
import { ProviderError, type PlatformConnector, type PublishInput, type PublishingProvider, type PublishResult, type ReconcileResult, type StoredTokens } from "@/providers/types";

/**
 * Instagram-Adapter (Live, UNGETESTET – es liegen keine Meta-Zugangsdaten vor).
 * Reels über die „Instagram API with Instagram Login“ (graph.instagram.com):
 *   1. Container anlegen: POST /{ig-user-id}/media (media_type=REELS, video_url, caption)
 *   2. Status abfragen:   GET /{container-id}?fields=status_code (IN_PROGRESS | FINISHED | PUBLISHED | ERROR | EXPIRED)
 *   3. Veröffentlichen:   POST /{ig-user-id}/media_publish (creation_id)
 * Voraussetzungen: Instagram-Professional-Konto (Business/Creator), Meta-App mit instagram_business_basic und
 * instagram_business_content_publish (App Review für fremde Konten), öffentlich erreichbare HTTPS-APP_URL –
 * Instagram lädt das Video über einen signierten, befristeten Link selbst herunter.
 * Die Container-ID wird sofort gespeichert; unklare Antworten werden über den Container-Status abgeglichen,
 * nie durch einen zweiten Upload.
 */
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const GRAPH = "https://graph.instagram.com";

export function instagramConfigured() {
  const e = env();
  return !!(e.INSTAGRAM_APP_ID && e.INSTAGRAM_APP_SECRET && e.CREDENTIALS_ENCRYPTION_KEY);
}

async function igJson<T>(res: Response, code: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || json.error) {
    const expired = json.error?.code === 190;
    throw new ProviderError(
      expired ? "INSTAGRAM_REVOKED" : code,
      expired ? "Der Instagram-Zugriff ist abgelaufen oder wurde widerrufen – bitte neu verbinden." : `Instagram: ${json.error?.message ?? `Fehler ${res.status}`}`,
      !expired && res.status >= 500,
      "instagram",
    );
  }
  return json;
}

export const instagramConnector: PlatformConnector = {
  platform: "instagram",
  scopes: INSTAGRAM_SCOPES,
  configured: instagramConfigured,
  authUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: env().INSTAGRAM_APP_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: INSTAGRAM_SCOPES.join(","),
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${p}`;
  },
  async connect(code, redirectUri) {
    const e = env();
    const short = await igJson<{ access_token?: string; user_id?: string | number; data?: { access_token: string; user_id: string | number }[] }>(
      await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({ client_id: e.INSTAGRAM_APP_ID!, client_secret: e.INSTAGRAM_APP_SECRET!, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
        signal: AbortSignal.timeout(15_000),
      }),
      "INSTAGRAM_TOKEN",
    );
    const shortToken = short.access_token ?? short.data?.[0]?.access_token;
    if (!shortToken) throw new ProviderError("INSTAGRAM_TOKEN", "Instagram hat kein Zugriffstoken geliefert.", false, "instagram");
    const long = await igJson<{ access_token: string; expires_in?: number }>(
      await fetch(`${GRAPH}/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: e.INSTAGRAM_APP_SECRET!, access_token: shortToken })}`, {
        signal: AbortSignal.timeout(15_000),
      }),
      "INSTAGRAM_TOKEN",
    );
    const me = await igJson<{ user_id?: string | number; id?: string; username?: string }>(
      await fetch(`${GRAPH}/${e.INSTAGRAM_GRAPH_VERSION}/me?${new URLSearchParams({ fields: "user_id,username", access_token: long.access_token })}`, {
        signal: AbortSignal.timeout(15_000),
      }),
      "INSTAGRAM_ACCOUNT",
    );
    const userId = String(me.user_id ?? me.id ?? "");
    if (!userId) throw new ProviderError("INSTAGRAM_ACCOUNT", "Instagram-Konto konnte nicht gelesen werden.", false, "instagram");
    return {
      tokens: { access_token: long.access_token, expires_at: Date.now() + (long.expires_in ?? 60 * 86400) * 1000, user_id: userId },
      accountId: userId,
      accountName: me.username ? `@${me.username}` : userId,
    };
  },
};

/** Langzeit-Token (ca. 60 Tage) wird rechtzeitig verlängert. */
async function accessTokenFor(connectionId: string) {
  const { conn, tokens: t } = await loadTokens(connectionId, "instagram");
  if (t.expires_at < Date.now()) {
    await markRevoked(conn.id, "Instagram-Token abgelaufen – bitte neu verbinden.");
    throw new ProviderError("INSTAGRAM_REVOKED", "Der Instagram-Zugriff ist abgelaufen – bitte neu verbinden.", false, "instagram");
  }
  if (t.expires_at - Date.now() < 7 * 86400_000) {
    try {
      const fresh = await igJson<{ access_token: string; expires_in?: number }>(
        await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: t.access_token })}`, { signal: AbortSignal.timeout(15_000) }),
        "INSTAGRAM_TOKEN",
      );
      const next: StoredTokens = { ...t, access_token: fresh.access_token, expires_at: Date.now() + (fresh.expires_in ?? 60 * 86400) * 1000 };
      await saveTokens(conn.id, next);
      return { token: next.access_token, userId: t.user_id ?? conn.externalAccountId ?? "" };
    } catch {
      /* Verlängerung best effort – das bisherige Token ist noch gültig */
    }
  }
  return { token: t.access_token, userId: t.user_id ?? conn.externalAccountId ?? "" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class InstagramPublishingProvider implements PublishingProvider {
  readonly platform = "instagram" as const;
  readonly name = "instagram" as const;
  readonly mode = "live" as const;
  /** Wie lange publish() auf die Verarbeitung wartet, bevor der Abgleich übernimmt */
  constructor(private waitMs = 90_000) {}

  private async containerStatus(containerId: string, token: string) {
    const v = env().INSTAGRAM_GRAPH_VERSION;
    return igJson<{ status_code?: string; status?: string }>(
      await fetch(`${GRAPH}/${v}/${containerId}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`, { signal: AbortSignal.timeout(15_000) }),
      "INSTAGRAM_STATUS",
    );
  }

  private async publishContainer(containerId: string, userId: string, token: string): Promise<{ id: string; url: string | null }> {
    const v = env().INSTAGRAM_GRAPH_VERSION;
    const res = await igJson<{ id: string }>(
      await fetch(`${GRAPH}/${v}/${userId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: containerId, access_token: token }),
        signal: AbortSignal.timeout(30_000),
      }),
      "INSTAGRAM_PUBLISH",
    );
    const link = await fetch(`${GRAPH}/${v}/${res.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => r.json() as Promise<{ permalink?: string }>)
      .catch(() => ({}) as { permalink?: string });
    return { id: res.id, url: link.permalink ?? null };
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.connectionId) throw new ProviderError("INSTAGRAM_NOT_CONNECTED", "Kein Instagram-Konto verbunden.", false, "instagram");
    if (input.format !== "short") throw new ProviderError("INSTAGRAM_FORMAT", "Instagram erhält nur Shorts (Reels im Hochformat).", false, "instagram");
    if (!input.publicVideoUrl?.startsWith("https://")) {
      throw new ProviderError("INSTAGRAM_URL", "Instagram braucht einen öffentlich erreichbaren HTTPS-Link auf das Video (APP_URL prüfen).", false, "instagram");
    }
    const { token, userId } = await accessTokenFor(input.connectionId);
    const v = env().INSTAGRAM_GRAPH_VERSION;
    const container = await igJson<{ id: string }>(
      await fetch(`${GRAPH}/${v}/${userId}/media`, {
        method: "POST",
        body: new URLSearchParams({ media_type: "REELS", video_url: input.publicVideoUrl, caption: input.caption, share_to_feed: "true", access_token: token }),
        signal: AbortSignal.timeout(30_000),
      }),
      "INSTAGRAM_CONTAINER",
    );
    await input.onUploadId?.(container.id);
    // Ab hier existiert ein Container: jede Unklarheit → Abgleich über den Container, kein zweiter Upload.
    try {
      const until = Date.now() + this.waitMs;
      while (Date.now() < until) {
        const st = await this.containerStatus(container.id, token);
        if (st.status_code === "FINISHED") {
          const media = await this.publishContainer(container.id, userId, token);
          return { status: "published", providerPostId: media.id, url: media.url };
        }
        if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
          throw new ProviderError("INSTAGRAM_PROCESSING", `Instagram konnte das Video nicht verarbeiten (${st.status ?? st.status_code}).`, false, "instagram");
        }
        await sleep(5_000);
      }
      return { status: "unknown", detail: "Instagram verarbeitet das Video noch – Abgleich folgt." };
    } catch (e) {
      if (e instanceof ProviderError && e.code === "INSTAGRAM_PROCESSING") throw e;
      return { status: "unknown", detail: (e as Error).message };
    }
  }

  async reconcile(input: PublishInput): Promise<ReconcileResult> {
    if (!input.connectionId || !input.uploadId) return { status: "not_found" };
    const { token, userId } = await accessTokenFor(input.connectionId);
    const st = await this.containerStatus(input.uploadId, token);
    if (st.status_code === "FINISHED") {
      const media = await this.publishContainer(input.uploadId, userId, token);
      return { status: "published", providerPostId: media.id, url: media.url };
    }
    if (st.status_code === "PUBLISHED") {
      // Beitrag ist online; die Medien-ID über die jüngsten Beiträge anhand der Caption zuordnen
      const v = env().INSTAGRAM_GRAPH_VERSION;
      const list = await fetch(`${GRAPH}/${v}/${userId}/media?${new URLSearchParams({ fields: "id,caption,permalink", limit: "10", access_token: token })}`)
        .then((r) => r.json() as Promise<{ data?: { id: string; caption?: string; permalink?: string }[] }>)
        .catch(() => ({ data: [] }) as { data?: { id: string; caption?: string; permalink?: string }[] });
      const hit = list.data?.find((m) => (m.caption ?? "").startsWith(input.caption.slice(0, 40)));
      return { status: "published", providerPostId: hit?.id ?? `container:${input.uploadId}`, url: hit?.permalink ?? null };
    }
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") return { status: "not_found" };
    return { status: "unknown" };
  }
}

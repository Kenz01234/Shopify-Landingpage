import fs from "node:fs";
import { env } from "@/lib/env";
import { resolveStorageKey } from "@/lib/storage";
import { loadTokens, markRevoked, saveTokens } from "@/providers/connection-tokens";
import { ProviderError, type PlatformConnector, type PublishInput, type PublishingProvider, type PublishResult, type ReconcileResult, type StoredTokens } from "@/providers/types";

/**
 * TikTok-Adapter (Live, UNGETESTET – es liegen keine TikTok-Zugangsdaten vor).
 * Content Posting API, Direct Post mit FILE_UPLOAD:
 *   1. POST /v2/post/publish/creator_info/query/  (erlaubte Sichtbarkeiten des Kontos)
 *   2. POST /v2/post/publish/video/init/          → publish_id + upload_url
 *   3. PUT upload_url in Stücken (5–64 MB, letztes Stück bis 128 MB; Dateien < 5 MB am Stück)
 *   4. POST /v2/post/publish/status/fetch/        → PUBLISH_COMPLETE | FAILED | PROCESSING_*
 * Wichtig: Solange TikTok die App nicht geprüft („audited“) hat, sind Beiträge nur privat sichtbar (SELF_ONLY).
 * TikTok verlangt außerdem, dass Nutzer:innen die Sichtbarkeit selbst wählen – siehe docs/INTEGRATIONEN.md.
 * Die publish_id wird sofort gespeichert; unklare Antworten werden über den Status abgeglichen, nie neu hochgeladen.
 */
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish"];
const API = "https://open.tiktokapis.com";
const MB = 1024 * 1024;

export function tiktokConfigured() {
  const e = env();
  return !!(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET && e.CREDENTIALS_ENCRYPTION_KEY);
}

type TikTokEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };

async function ttJson<T>(res: Response, code: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as TikTokEnvelope<T> & Record<string, unknown>;
  const errCode = json.error?.code;
  if (!res.ok || (errCode && errCode !== "ok")) {
    const revoked = errCode === "access_token_invalid" || errCode === "scope_not_authorized";
    throw new ProviderError(
      revoked ? "TIKTOK_REVOKED" : code,
      revoked ? "Der TikTok-Zugriff ist abgelaufen oder wurde widerrufen – bitte neu verbinden." : `TikTok: ${json.error?.message || `Fehler ${res.status}`}`,
      !revoked && (res.status >= 500 || errCode === "rate_limit_exceeded"),
      "tiktok",
    );
  }
  return (json.data ?? json) as T;
}

async function tokenRequest(body: Record<string, string>): Promise<StoredTokens & { open_id?: string }> {
  const e = env();
  const res = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY!, client_secret: e.TIKTOK_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const revoked = json.error === "invalid_grant";
    throw new ProviderError(revoked ? "TIKTOK_REVOKED" : "TIKTOK_TOKEN", revoked ? "Der TikTok-Zugriff ist abgelaufen – bitte neu verbinden." : "TikTok-Token-Anfrage fehlgeschlagen.", !revoked, "tiktok");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 86400) * 1000,
    refresh_expires_at: json.refresh_expires_in ? Date.now() + json.refresh_expires_in * 1000 : undefined,
    user_id: json.open_id,
    open_id: json.open_id,
  };
}

export const tiktokConnector: PlatformConnector = {
  platform: "tiktok",
  scopes: TIKTOK_SCOPES,
  configured: tiktokConfigured,
  authUrl(state, redirectUri) {
    const p = new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, scope: TIKTOK_SCOPES.join(","), response_type: "code", redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
  },
  async connect(code, redirectUri) {
    const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
    const info = await ttJson<{ user?: { open_id?: string; display_name?: string } }>(
      await fetch(`${API}/v2/user/info/?fields=open_id,display_name`, { headers: { authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15_000) }),
      "TIKTOK_ACCOUNT",
    );
    const id = info.user?.open_id ?? tokens.open_id ?? "";
    return { tokens, accountId: id, accountName: info.user?.display_name ?? id };
  },
  async revoke(t) {
    const e = env();
    await fetch(`${API}/v2/oauth/revoke/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY!, client_secret: e.TIKTOK_CLIENT_SECRET!, token: t.access_token }),
      signal: AbortSignal.timeout(10_000),
    });
  },
};

async function accessTokenFor(connectionId: string) {
  const { conn, tokens: t } = await loadTokens(connectionId, "tiktok");
  if (t.expires_at - 60_000 > Date.now()) return t.access_token;
  if (!t.refresh_token || (t.refresh_expires_at && t.refresh_expires_at < Date.now())) {
    await markRevoked(conn.id, "TikTok-Zugriff abgelaufen – bitte neu verbinden.");
    throw new ProviderError("TIKTOK_REVOKED", "Der TikTok-Zugriff ist abgelaufen – bitte neu verbinden.", false, "tiktok");
  }
  try {
    const fresh = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
    await saveTokens(conn.id, { ...t, ...fresh, refresh_token: fresh.refresh_token ?? t.refresh_token });
    return fresh.access_token;
  } catch (e) {
    if (e instanceof ProviderError && e.code === "TIKTOK_REVOKED") await markRevoked(conn.id, e.message);
    throw e;
  }
}

/** Stückelung laut TikTok Media Transfer Guide */
export function chunkPlan(size: number) {
  if (size < 5 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.max(1, Math.floor(size / chunkSize)) };
}

const post = (token: string, path: string, body: unknown) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

type StatusData = { status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] };

function interpret(st: StatusData, publishId: string): ReconcileResult | { status: "failed"; reason: string } {
  if (st.status === "PUBLISH_COMPLETE") {
    const postId = st.publicaly_available_post_id?.[0];
    return { status: "published", providerPostId: postId ? String(postId) : `publish:${publishId}`, url: null };
  }
  if (st.status === "FAILED") return { status: "failed", reason: st.fail_reason ?? "unbekannt" };
  return { status: "unknown" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TikTokPublishingProvider implements PublishingProvider {
  readonly platform = "tiktok" as const;
  readonly name = "tiktok" as const;
  readonly mode = "live" as const;
  constructor(private waitMs = 60_000) {}

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.connectionId) throw new ProviderError("TIKTOK_NOT_CONNECTED", "Kein TikTok-Konto verbunden.", false, "tiktok");
    if (input.format !== "short") throw new ProviderError("TIKTOK_FORMAT", "TikTok erhält nur Shorts im Hochformat.", false, "tiktok");
    if (!input.videoStorageKey) throw new ProviderError("NO_MEDIA", "Keine Videodatei vorhanden.", false, "tiktok");
    const token = await accessTokenFor(input.connectionId);

    const creator = await ttJson<{ privacy_level_options?: string[]; max_video_post_duration_sec?: number }>(
      await post(token, "/v2/post/publish/creator_info/query/", {}),
      "TIKTOK_CREATOR",
    );
    const wanted = env().TIKTOK_PRIVACY_LEVEL;
    const privacy = creator.privacy_level_options?.includes(wanted) ? wanted : "SELF_ONLY";

    const filePath = resolveStorageKey(input.videoStorageKey);
    const size = fs.statSync(filePath).size;
    const plan = chunkPlan(size);
    const init = await ttJson<{ publish_id: string; upload_url: string }>(
      await post(token, "/v2/post/publish/video/init/", {
        post_info: { title: input.caption, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: plan.chunkSize, total_chunk_count: plan.count },
      }),
      "TIKTOK_INIT",
    );
    await input.onUploadId?.(init.publish_id);

    // Ab hier existiert ein TikTok-Upload: Fehler → „unknown“ → Abgleich über publish_id, kein zweiter Upload.
    try {
      const fd = fs.openSync(filePath, "r");
      try {
        for (let i = 0; i < plan.count; i++) {
          const start = i * plan.chunkSize;
          const end = i === plan.count - 1 ? size - 1 : start + plan.chunkSize - 1;
          const buf = Buffer.alloc(end - start + 1);
          fs.readSync(fd, buf, 0, buf.length, start);
          const put = await fetch(init.upload_url, {
            method: "PUT",
            headers: { "content-type": "video/mp4", "content-length": String(buf.length), "content-range": `bytes ${start}-${end}/${size}` },
            body: buf,
            signal: AbortSignal.timeout(10 * 60_000),
          });
          if (!put.ok) return { status: "unknown", detail: `Upload-Stück ${i + 1}/${plan.count}: Antwort ${put.status}` };
        }
      } finally {
        fs.closeSync(fd);
      }
      const until = Date.now() + this.waitMs;
      while (Date.now() < until) {
        const r = interpret(await ttJson<StatusData>(await post(token, "/v2/post/publish/status/fetch/", { publish_id: init.publish_id }), "TIKTOK_STATUS"), init.publish_id);
        if (r.status === "published") return { status: "published", providerPostId: r.providerPostId, url: r.url };
        if (r.status === "failed") throw new ProviderError("TIKTOK_FAILED", `TikTok hat den Beitrag abgelehnt (${r.reason}).`, false, "tiktok");
        await sleep(5_000);
      }
      return { status: "unknown", detail: "TikTok verarbeitet das Video noch – Abgleich folgt." };
    } catch (e) {
      if (e instanceof ProviderError && e.code === "TIKTOK_FAILED") throw e;
      return { status: "unknown", detail: (e as Error).message };
    }
  }

  async reconcile(input: PublishInput): Promise<ReconcileResult> {
    if (!input.connectionId || !input.uploadId) return { status: "not_found" };
    const token = await accessTokenFor(input.connectionId);
    const r = interpret(await ttJson<StatusData>(await post(token, "/v2/post/publish/status/fetch/", { publish_id: input.uploadId }), "TIKTOK_STATUS"), input.uploadId);
    if (r.status === "failed") return { status: "not_found" };
    return r;
  }
}

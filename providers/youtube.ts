import fs from "node:fs";
import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";
import { resolveStorageKey } from "@/lib/storage";
import { ProviderError, type PublishInput, type PublishingProvider, type PublishResult } from "@/providers/types";

/**
 * YouTube-Adapter (Live, UNGETESTET – es liegen keine OAuth-Zugangsdaten vor).
 * - OAuth 2.0 Authorization Code mit offline access; niemals Google-Passwörter abfragen.
 * - Minimale Scopes: youtube.upload (Upload) + youtube.readonly (Kanal-Zuordnung, Abgleich).
 * - Upload per „resumable upload“ erst zum freigegebenen Termin.
 * - Unklare Antworten werden NICHT durch erneuten Upload wiederholt, sondern per reconcile() abgeglichen
 *   (Markierung über ein Tag „qa-<id>“).
 * Hinweis: Uploads aus nicht verifizierten Google-Cloud-Projekten werden von YouTube auf „privat“ beschränkt.
 */
export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

type Tokens = { access_token: string; refresh_token?: string; expires_at: number };

export function youtubeConfigured() {
  const e = env();
  return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.CREDENTIALS_ENCRYPTION_KEY);
}

export function buildAuthUrl(state: string) {
  const e = env();
  const p = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl()}/api/connections/youtube/callback`,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const e = env();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    const revoked = json.error === "invalid_grant";
    throw new ProviderError(revoked ? "YOUTUBE_REVOKED" : "YOUTUBE_TOKEN", revoked ? "Der YouTube-Zugriff wurde widerrufen oder ist abgelaufen." : "Token-Anfrage fehlgeschlagen.", !revoked, "youtube");
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: Date.now() + (json.expires_in ?? 3600) * 1000 };
}

export async function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: `${appUrl()}/api/connections/youtube/callback` });
}

export async function fetchOwnChannel(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new ProviderError("YOUTUBE_CHANNEL", `Kanal konnte nicht gelesen werden (${res.status}).`, res.status >= 500, "youtube");
  const json = (await res.json()) as { items?: { id: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] };
  const ch = json.items?.[0];
  if (!ch) throw new ProviderError("YOUTUBE_NO_CHANNEL", "Mit diesem Google-Konto ist kein YouTube-Kanal verknüpft.", false, "youtube");
  return { id: ch.id, title: ch.snippet?.title ?? ch.id, uploadsPlaylist: ch.contentDetails?.relatedPlaylists?.uploads ?? null };
}

export function sealTokens(t: Tokens) {
  return encryptJson(t);
}

async function accessTokenFor(connectionId: string) {
  const conn = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.status !== "connected" || !conn.encryptedCredentials) {
    throw new ProviderError("YOUTUBE_NOT_CONNECTED", "Kein verbundener YouTube-Kanal.", false, "youtube");
  }
  const t = decryptJson<Tokens>(conn.encryptedCredentials);
  if (t.expires_at - 60_000 > Date.now()) return t.access_token;
  if (!t.refresh_token) throw new ProviderError("YOUTUBE_REVOKED", "Kein Refresh-Token vorhanden – bitte neu verbinden.", false, "youtube");
  try {
    const fresh = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
    await prisma.providerConnection.update({
      where: { id: conn.id },
      data: { encryptedCredentials: sealTokens({ ...fresh, refresh_token: t.refresh_token }), tokenExpiresAt: new Date(fresh.expires_at), lastCheckedAt: new Date() },
    });
    return fresh.access_token;
  } catch (e) {
    if (e instanceof ProviderError && e.code === "YOUTUBE_REVOKED") {
      await prisma.providerConnection.update({ where: { id: conn.id }, data: { status: "revoked", lastError: e.message } });
    }
    throw e;
  }
}

const marker = (publicationId: string) => `qa-${publicationId.slice(-12)}`;

export class YouTubePublishingProvider implements PublishingProvider {
  readonly name = "youtube" as const;
  readonly mode = "live" as const;

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.connectionId) throw new ProviderError("YOUTUBE_NOT_CONNECTED", "Kein YouTube-Kanal zugeordnet.", false, "youtube");
    if (!input.videoStorageKey) throw new ProviderError("NO_MEDIA", "Keine Videodatei vorhanden.", false, "youtube");
    const token = await accessTokenFor(input.connectionId);
    const filePath = resolveStorageKey(input.videoStorageKey);
    const size = fs.statSync(filePath).size;
    const meta = {
      snippet: { title: input.title, description: input.description, tags: [...input.tags, marker(input.publicationId)] },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    };
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(size),
        "x-upload-content-type": "video/*",
      },
      body: JSON.stringify(meta),
      signal: AbortSignal.timeout(30_000),
    });
    if (init.status === 403) throw new ProviderError("YOUTUBE_QUOTA", "YouTube-Kontingent erschöpft oder Upload nicht erlaubt.", true, "youtube");
    if (!init.ok) throw new ProviderError("YOUTUBE_INIT", `Upload konnte nicht gestartet werden (${init.status}).`, init.status >= 500, "youtube");
    const location = init.headers.get("location");
    if (!location) throw new ProviderError("YOUTUBE_INIT", "Upload-Sitzung ohne Adresse.", true, "youtube");
    // Ab hier ist unklar, ob YouTube das Video angelegt hat: Fehler → „unknown“ → Abgleich statt Neu-Upload.
    try {
      const put = await fetch(location, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-length": String(size), "content-type": "video/*" },
        body: fs.readFileSync(filePath),
        signal: AbortSignal.timeout(30 * 60_000),
      });
      if (put.ok) {
        const json = (await put.json()) as { id?: string };
        if (json.id) return { status: "published", providerVideoId: json.id };
      }
      return { status: "unknown", detail: `Upload-Antwort ${put.status}` };
    } catch (e) {
      return { status: "unknown", detail: (e as Error).message };
    }
  }

  async reconcile(input: PublishInput) {
    if (!input.connectionId) return { status: "unknown" as const };
    const token = await accessTokenFor(input.connectionId);
    const ch = await fetchOwnChannel(token);
    if (!ch.uploadsPlaylist) return { status: "unknown" as const };
    const list = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${encodeURIComponent(ch.uploadsPlaylist)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!list.ok) return { status: "unknown" as const };
    const items = ((await list.json()) as { items?: { contentDetails?: { videoId?: string } }[] }).items ?? [];
    const ids = items.map((i) => i.contentDetails?.videoId).filter(Boolean).join(",");
    if (!ids) return { status: "not_found" as const };
    const vids = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}`, { headers: { authorization: `Bearer ${token}` } });
    if (!vids.ok) return { status: "unknown" as const };
    const found = ((await vids.json()) as { items?: { id: string; snippet?: { tags?: string[] } }[] }).items?.find((v) =>
      v.snippet?.tags?.includes(marker(input.publicationId)),
    );
    return found ? { status: "published" as const, providerVideoId: found.id } : { status: "not_found" as const };
  }
}

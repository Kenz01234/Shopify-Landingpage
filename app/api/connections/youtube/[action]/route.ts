import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { prisma } from "@/lib/db";
import { appUrl, env, isDemoMode } from "@/lib/env";
import { AppError, notFound } from "@/lib/errors";
import { getViewer } from "@/lib/session";
import { audit } from "@/lib/audit";
import { decryptJson } from "@/lib/crypto";
import { buildAuthUrl, exchangeCode, fetchOwnChannel, sealTokens, youtubeConfigured, YOUTUBE_SCOPES } from "@/providers/youtube";

/** YouTube-Verbindung über den offiziellen OAuth-Ablauf. Es werden nie Google-Passwörter abgefragt. */
export const POST = api<{ action: string }>(async ({ ctx, params }) => {
  switch (params.action) {
    case "start": {
      if (!youtubeConfigured()) {
        throw new AppError("NOT_CONFIGURED", "Die YouTube-Anbindung ist vom Betreiber noch nicht eingerichtet (Google-OAuth-Zugangsdaten fehlen).", 503);
      }
      const state = crypto.randomBytes(24).toString("base64url");
      (await cookies()).set("qa_yt_state", state, { httpOnly: true, sameSite: "lax", secure: appUrl().startsWith("https"), path: "/api/connections/youtube", maxAge: 600 });
      return { redirect: buildAuthUrl(state) };
    }
    case "demo": {
      if (!isDemoMode()) throw new AppError("NOT_DEMO", "Nur im Demo-Modus.", 400);
      await prisma.providerConnection.upsert({
        where: { organizationId_provider: { organizationId: ctx.orgId, provider: "youtube" } },
        create: { organizationId: ctx.orgId, provider: "youtube", mode: "demo", status: "demo", displayName: "Demo-Kanal (simuliert)", scopes: [] },
        update: { mode: "demo", status: "demo", displayName: "Demo-Kanal (simuliert)", encryptedCredentials: null, lastError: null },
      });
      await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "connection.youtube.demo" });
      return { ok: true };
    }
    case "disconnect": {
      const conn = await prisma.providerConnection.findUnique({ where: { organizationId_provider: { organizationId: ctx.orgId, provider: "youtube" } } });
      if (!conn) return { ok: true };
      if (conn.encryptedCredentials) {
        try {
          const t = decryptJson<{ refresh_token?: string; access_token: string }>(conn.encryptedCredentials);
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token ?? t.access_token)}`, { method: "POST", signal: AbortSignal.timeout(10_000) });
        } catch {
          /* Widerruf best effort – lokale Daten werden trotzdem gelöscht */
        }
      }
      await prisma.providerConnection.update({ where: { id: conn.id }, data: { status: "not_connected", encryptedCredentials: null, tokenExpiresAt: null, externalAccountId: null, displayName: null } });
      await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "connection.youtube.disconnect" });
      return { ok: true };
    }
    default:
      throw notFound("Aktion");
  }
});

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "callback") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const viewer = await getViewer();
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/verbindungen?youtube=${q}`);
  if (!viewer) return NextResponse.redirect(`${appUrl()}/login`);
  const u = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("qa_yt_state")?.value;
  jar.delete({ name: "qa_yt_state", path: "/api/connections/youtube" });
  if (u.searchParams.get("error")) return back("abgelehnt");
  const state = u.searchParams.get("state");
  const code = u.searchParams.get("code");
  if (!expected || !state || state !== expected || !code) return back("ungueltig");
  if (!youtubeConfigured()) return back("nicht-konfiguriert");
  try {
    const tokens = await exchangeCode(code);
    const channel = await fetchOwnChannel(tokens.access_token);
    await prisma.providerConnection.upsert({
      where: { organizationId_provider: { organizationId: viewer.org.id, provider: "youtube" } },
      create: {
        organizationId: viewer.org.id,
        provider: "youtube",
        mode: "live",
        status: "connected",
        displayName: channel.title,
        externalAccountId: channel.id,
        encryptedCredentials: sealTokens(tokens),
        scopes: YOUTUBE_SCOPES,
        tokenExpiresAt: new Date(tokens.expires_at),
        lastCheckedAt: new Date(),
      },
      update: {
        mode: "live",
        status: "connected",
        displayName: channel.title,
        externalAccountId: channel.id,
        encryptedCredentials: sealTokens(tokens),
        scopes: YOUTUBE_SCOPES,
        tokenExpiresAt: new Date(tokens.expires_at),
        lastCheckedAt: new Date(),
        lastError: null,
      },
    });
    await audit(prisma, { orgId: viewer.org.id, actor: { type: "user", userId: viewer.user.id }, action: "connection.youtube.connected", meta: { channelId: channel.id } });
    void env;
    return back("verbunden");
  } catch {
    return back("fehler");
  }
}

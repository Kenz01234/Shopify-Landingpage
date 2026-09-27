import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { prisma } from "@/lib/db";
import { appUrl, isDemoMode } from "@/lib/env";
import { AppError, notFound } from "@/lib/errors";
import { getViewer } from "@/lib/session";
import { audit } from "@/lib/audit";
import { decryptJson } from "@/lib/crypto";
import { PLATFORM_KEYS, PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { CONNECTORS } from "@/providers";
import { sealTokens } from "@/providers/connection-tokens";
import type { StoredTokens } from "@/providers/types";

/**
 * Plattform-Verbindungen (YouTube, Instagram, TikTok) über den offiziellen OAuth-Ablauf der jeweiligen Plattform.
 * Es werden nie Passwörter abgefragt. Tokens werden verschlüsselt gespeichert; ein State-Cookie schützt den Rücksprung.
 */
const isPlatform = (p: string): p is PlatformKey => (PLATFORM_KEYS as string[]).includes(p);
const redirectUri = (p: PlatformKey) => `${appUrl()}/api/connections/${p}/callback`;
const stateCookie = (p: PlatformKey) => `qa_${p}_state`;

export const POST = api<{ platform: string; action: string }>(async ({ ctx, params }) => {
  if (!isPlatform(params.platform)) throw notFound("Plattform");
  const platform = params.platform;
  const label = PLATFORMS[platform].label;
  const where = { organizationId_provider: { organizationId: ctx.orgId, provider: platform } };
  switch (params.action) {
    case "start": {
      if (!CONNECTORS[platform].configured()) {
        throw new AppError("NOT_CONFIGURED", `Die ${label}-Anbindung ist vom Betreiber noch nicht eingerichtet (App-Zugangsdaten fehlen).`, 503);
      }
      const state = crypto.randomBytes(24).toString("base64url");
      (await cookies()).set(stateCookie(platform), state, {
        httpOnly: true,
        sameSite: "lax",
        secure: appUrl().startsWith("https"),
        path: `/api/connections/${platform}`,
        maxAge: 600,
      });
      return { redirect: CONNECTORS[platform].authUrl(state, redirectUri(platform)) };
    }
    case "demo": {
      if (!isDemoMode()) throw new AppError("NOT_DEMO", "Nur im Demo-Modus.", 400);
      const displayName = `Demo-${platform === "youtube" ? "Kanal" : "Konto"} (simuliert)`;
      await prisma.providerConnection.upsert({
        where,
        create: { organizationId: ctx.orgId, provider: platform, mode: "demo", status: "demo", displayName, scopes: [] },
        update: { mode: "demo", status: "demo", displayName, encryptedCredentials: null, lastError: null },
      });
      await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: `connection.${platform}.demo` });
      return { ok: true };
    }
    case "disconnect": {
      const conn = await prisma.providerConnection.findUnique({ where });
      if (!conn) return { ok: true };
      if (conn.encryptedCredentials) {
        try {
          await CONNECTORS[platform].revoke?.(decryptJson<StoredTokens>(conn.encryptedCredentials));
        } catch {
          /* Widerruf best effort – lokale Daten werden trotzdem gelöscht */
        }
      }
      await prisma.providerConnection.update({
        where: { id: conn.id },
        data: { status: "not_connected", encryptedCredentials: null, tokenExpiresAt: null, externalAccountId: null, displayName: null },
      });
      await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: `connection.${platform}.disconnect` });
      return { ok: true };
    }
    default:
      throw notFound("Aktion");
  }
});

export async function GET(req: Request, { params }: { params: Promise<{ platform: string; action: string }> }) {
  const { platform, action } = await params;
  if (action !== "callback" || !isPlatform(platform)) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const viewer = await getViewer();
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/verbindungen?plattform=${platform}&status=${q}`);
  if (!viewer) return NextResponse.redirect(`${appUrl()}/login`);
  const u = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get(stateCookie(platform))?.value;
  jar.delete({ name: stateCookie(platform), path: `/api/connections/${platform}` });
  if (u.searchParams.get("error")) return back("abgelehnt");
  const state = u.searchParams.get("state");
  const code = u.searchParams.get("code");
  if (!expected || !state || state !== expected || !code) return back("ungueltig");
  const connector = CONNECTORS[platform];
  if (!connector.configured()) return back("nicht-konfiguriert");
  try {
    const r = await connector.connect(code, redirectUri(platform));
    const data = {
      mode: "live",
      status: "connected" as const,
      displayName: r.accountName,
      externalAccountId: r.accountId,
      encryptedCredentials: sealTokens(r.tokens),
      scopes: connector.scopes,
      tokenExpiresAt: new Date(r.tokens.expires_at),
      lastCheckedAt: new Date(),
      lastError: null,
    };
    await prisma.providerConnection.upsert({
      where: { organizationId_provider: { organizationId: viewer.org.id, provider: platform } },
      create: { organizationId: viewer.org.id, provider: platform, ...data },
      update: data,
    });
    await audit(prisma, { orgId: viewer.org.id, actor: { type: "user", userId: viewer.user.id }, action: `connection.${platform}.connected`, meta: { accountId: r.accountId } });
    return back("verbunden");
  } catch {
    return back("fehler");
  }
}

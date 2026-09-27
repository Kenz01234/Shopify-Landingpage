import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { ProviderError, type StoredTokens } from "@/providers/types";

/** Gemeinsame Token-Verwaltung der Plattform-Verbindungen (AES-256-GCM, nie im Klartext gespeichert). */
export async function loadTokens(connectionId: string, platform: PlatformKey) {
  const conn = await prisma.providerConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.provider !== platform || conn.status !== "connected" || !conn.encryptedCredentials) {
    throw new ProviderError(`${platform.toUpperCase()}_NOT_CONNECTED`, `Kein verbundenes ${PLATFORMS[platform].label}-Konto.`, false, platform);
  }
  return { conn, tokens: decryptJson<StoredTokens>(conn.encryptedCredentials) };
}

export async function saveTokens(connectionId: string, tokens: StoredTokens) {
  await prisma.providerConnection.update({
    where: { id: connectionId },
    data: { encryptedCredentials: encryptJson(tokens), tokenExpiresAt: new Date(tokens.expires_at), lastCheckedAt: new Date(), lastError: null },
  });
}

export async function markRevoked(connectionId: string, message: string) {
  await prisma.providerConnection.update({ where: { id: connectionId }, data: { status: "revoked", lastError: message } });
}

export const sealTokens = (t: StoredTokens) => encryptJson(t);

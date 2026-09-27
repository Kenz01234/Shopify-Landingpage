import crypto from "node:crypto";
import { appUrl, env } from "@/lib/env";

/**
 * Befristete, signierte Medienlinks – nur für Plattformen, die ein Video selbst abrufen (Instagram).
 * Der Link verrät keine internen Pfade und läuft nach `ttlSec` ab.
 */
const key = () => crypto.createHmac("sha256", env().BETTER_AUTH_SECRET).update("quest-agent:media-link:v1").digest();
const sign = (payload: string) => crypto.createHmac("sha256", key()).update(payload).digest("base64url");

export function signMediaToken(assetId: string, ttlSec = 2 * 3600, nowMs = Date.now()) {
  const payload = `${assetId}.${Math.floor(nowMs / 1000) + ttlSec}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyMediaToken(token: string, nowMs = Date.now()): { assetId: string } | null {
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const payload = Buffer.from(p, "base64url").toString("utf8");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  const [assetId, exp] = payload.split(".");
  if (!assetId || !Number.isFinite(Number(exp)) || Number(exp) * 1000 < nowMs) return null;
  return { assetId };
}

export const signedMediaUrl = (assetId: string, ttlSec?: number) => `${appUrl()}/api/public-media/${signMediaToken(assetId, ttlSec)}`;

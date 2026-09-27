import crypto from "node:crypto";

/**
 * Verschlüsselung kundenindividueller Zugangsdaten (z. B. YouTube-Refresh-Token) mit AES-256-GCM
 * aus Node.js-Crypto. Schlüssel: CREDENTIALS_ENCRYPTION_KEY (32 Byte, Base64).
 */
function key(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY ist nicht gesetzt.");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY muss 32 Byte (Base64) lang sein.");
  return k;
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptJson<T>(payload: string): T {
  const [v, ivB, tagB, encB] = payload.split(".");
  if (v !== "v1") throw new Error("Unbekanntes Format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

/** HMAC-SHA256 über „timestamp.body“ – für n8n-Aufrufe und -Rückmeldungen. */
export function signPayload(secret: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifySignature(secret: string, timestamp: string, body: string, signature: string, toleranceSec = 300, nowMs = Date.now()) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > toleranceSec) return false;
  const expected = signPayload(secret, timestamp, body);
  const sig = signature.replace(/^sha256=/, "");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

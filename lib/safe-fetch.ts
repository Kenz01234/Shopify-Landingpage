import dns from "node:dns/promises";
import net from "node:net";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Kontrollierte Verarbeitung externer URLs (z. B. Medien-Links aus n8n-Ergebnissen):
 * nur https, nur freigegebene Hosts, keine privaten/lokalen Ziele, keine Weiterleitungen,
 * Größen- und Zeitlimit. Anweisungen aus fremden Inhalten werden nie ausgeführt.
 */

export class UnsafeUrlError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export async function assertSafeUrl(raw: string, allowedHosts: string[]) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Ungültige URL");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("Nur https ist erlaubt");
  if (url.username || url.password) throw new UnsafeUrlError("Zugangsdaten in URLs sind nicht erlaubt");
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) throw new UnsafeUrlError(`Host ${host} ist nicht freigegeben`);
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("Private Adressen sind nicht erlaubt");
  } else {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("Host löst auf private Adresse auf");
  }
  return url;
}

export async function safeDownload(raw: string, dest: string, opts: { allowedHosts: string[]; maxBytes: number; timeoutMs?: number }) {
  const url = await assertSafeUrl(raw, opts.allowedHosts);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    if (res.status >= 300 && res.status < 400) throw new UnsafeUrlError("Weiterleitungen sind nicht erlaubt");
    if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (${res.status})`);
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len && len > opts.maxBytes) throw new UnsafeUrlError("Datei ist zu groß");
    let seen = 0;
    const limited = Readable.fromWeb(res.body as never).on("data", (chunk: Buffer) => {
      seen += chunk.length;
      if (seen > opts.maxBytes) ctrl.abort();
    });
    await pipeline(limited, fs.createWriteStream(dest));
    return { bytes: seen, mimeType: res.headers.get("content-type") ?? "application/octet-stream" };
  } finally {
    clearTimeout(t);
  }
}

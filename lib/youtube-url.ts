/**
 * Validierung von YouTube-Kanal-Angaben – rein lokal, ohne Netzwerkabfrage.
 * Akzeptiert: @handle, youtube.com/@handle, /channel/UC…, /c/Name, /user/Name, youtube.com/Name.
 */

export type ChannelRef = {
  kind: "handle" | "channel_id" | "custom" | "user" | "legacy";
  identifier: string;
  url: string;
};

export type ChannelParseResult = { ok: true; value: ChannelRef } | { ok: false; error: string };

const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const RESERVED = new Set([
  "watch", "shorts", "playlist", "results", "feed", "channel", "c", "user", "embed", "live", "hashtag",
  "account", "premium", "music", "kids", "gaming", "about", "t", "redirect", "signin", "logout", "post", "clip",
]);
const HANDLE = /^[A-Za-z0-9._-]{3,30}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function parseYouTubeChannel(raw: string): ChannelParseResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "Bitte einen Kanal angeben." };
  if (input.length > 300) return { ok: false, error: "Die Angabe ist zu lang." };

  if (input.startsWith("@")) {
    const h = input.slice(1);
    if (!HANDLE.test(h)) return { ok: false, error: "Ungültiger Handle. Erlaubt sind 3–30 Buchstaben, Ziffern, Punkt, Binde- und Unterstrich." };
    return { ok: true, value: { kind: "handle", identifier: `@${h}`, url: `https://www.youtube.com/@${h}` } };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: "Das ist weder ein @Handle noch ein gültiger Link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Nur http(s)-Links sind erlaubt." };
  if (url.username || url.password) return { ok: false, error: "Links mit Zugangsdaten sind nicht erlaubt." };
  if (url.port) return { ok: false, error: "Links mit Portangabe sind nicht erlaubt." };
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") return { ok: false, error: "Das ist ein Video-Link. Bitte den Link zum Kanal angeben." };
  if (!ALLOWED_HOSTS.has(host)) return { ok: false, error: "Bitte einen Link von youtube.com angeben." };

  const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponentSafe(p));
  if (parts.length === 0) return { ok: false, error: "Der Link enthält keinen Kanal." };
  const [first, second] = parts;

  if (first === "watch" || first === "shorts" || first === "playlist" || first === "embed" || first === "live") {
    return { ok: false, error: "Das ist ein Video- oder Playlist-Link. Bitte den Link zum Kanal angeben." };
  }
  if (first.startsWith("@")) {
    const h = first.slice(1);
    if (!HANDLE.test(h)) return { ok: false, error: "Ungültiger Handle im Link." };
    return { ok: true, value: { kind: "handle", identifier: `@${h}`, url: `https://www.youtube.com/@${h}` } };
  }
  if (first === "channel") {
    if (!second || !CHANNEL_ID.test(second)) return { ok: false, error: "Ungültige Kanal-ID (erwartet: UC + 22 Zeichen)." };
    return { ok: true, value: { kind: "channel_id", identifier: second, url: `https://www.youtube.com/channel/${second}` } };
  }
  if (first === "c" || first === "user") {
    if (!second || !NAME.test(second)) return { ok: false, error: "Ungültiger Kanalname im Link." };
    return {
      ok: true,
      value: { kind: first === "c" ? "custom" : "user", identifier: second, url: `https://www.youtube.com/${first}/${second}` },
    };
  }
  if (!RESERVED.has(first.toLowerCase()) && NAME.test(first) && first.length >= 3) {
    return { ok: true, value: { kind: "legacy", identifier: first, url: `https://www.youtube.com/${first}` } };
  }
  return { ok: false, error: "Dieser Link zeigt nicht auf einen Kanal." };
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

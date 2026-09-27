import { describe, expect, it } from "vitest";
import { parseYouTubeChannel } from "@/lib/youtube-url";

describe("YouTube-Kanalangaben", () => {
  it.each([
    ["@kanal_name", "https://www.youtube.com/@kanal_name"],
    ["youtube.com/@kanal.name", "https://www.youtube.com/@kanal.name"],
    ["https://m.youtube.com/@kanal/videos", "https://www.youtube.com/@kanal"],
    ["https://www.youtube.com/channel/UC0123456789abcdefABCDEF", "https://www.youtube.com/channel/UC0123456789abcdefABCDEF"],
    ["www.youtube.com/c/MeinKanal", "https://www.youtube.com/c/MeinKanal"],
    ["http://youtube.com/user/altername", "https://www.youtube.com/user/altername"],
  ])("akzeptiert %s", (input, url) => {
    const r = parseYouTubeChannel(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.url).toBe(url);
  });
  it.each([
    ["", "Bitte"],
    ["https://youtu.be/abc", "Video-Link"],
    ["https://www.youtube.com/watch?v=abc", "Video"],
    ["https://youtube.com.evil.example/@x", "youtube.com"],
    ["https://user:pw@youtube.com/@kanal", "Zugangsdaten"],
    ["https://youtube.com:8443/@kanal", "Port"],
    ["javascript:alert(1)", "gültiger Link"],
    ["https://www.youtube.com/channel/UCzukurz", "Kanal-ID"],
    ["@a", "Handle"],
  ])("lehnt %s ab", (input, msg) => {
    const r = parseYouTubeChannel(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
});

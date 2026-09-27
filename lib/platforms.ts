/**
 * Plattformen, auf denen Quest Agent veröffentlicht. Ohne Server-Abhängigkeiten – auch in Client-Komponenten nutzbar.
 * Longform geht immer zu YouTube; Shorts wahlweise zu YouTube Shorts, Instagram Reels und TikTok.
 */
export type PlatformKey = "youtube" | "instagram" | "tiktok";

export const PLATFORM_KEYS: PlatformKey[] = ["youtube", "instagram", "tiktok"];

export const PLATFORMS: Record<
  PlatformKey,
  { label: string; shortLabel: string; longLabel: string | null; hint: string; captionLimit: number; accent: string }
> = {
  youtube: {
    label: "YouTube",
    shortLabel: "YouTube Shorts",
    longLabel: "YouTube",
    hint: "Videos im Querformat und Shorts",
    captionLimit: 5000,
    accent: "#ff0033",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "Instagram Reels",
    longLabel: null,
    hint: "Reels im Hochformat – braucht ein Instagram-Professional-Konto",
    captionLimit: 2200,
    accent: "#d62976",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "TikTok",
    longLabel: null,
    hint: "Hochformat-Videos",
    captionLimit: 2200,
    accent: "#25f4ee",
  },
};

export const LONGFORM_PLATFORMS: PlatformKey[] = ["youtube"];

export function platformsFor(format: "longform" | "short", shortPlatforms: readonly PlatformKey[] | null | undefined): PlatformKey[] {
  if (format === "longform") return LONGFORM_PLATFORMS;
  const list = PLATFORM_KEYS.filter((p) => shortPlatforms?.includes(p));
  return list.length ? list : ["youtube"];
}

/** Beitragstext für Instagram/TikTok: gespeicherter Text oder aus Titel und Tags abgeleitet. */
export function captionFor(v: { caption?: string | null; title: string; tags: string[] }, platform: PlatformKey): string {
  const limit = PLATFORMS[platform].captionLimit;
  const text = v.caption?.trim()
    ? v.caption.trim()
    : [v.title.replace(/\s*#shorts\b/i, "").trim(), v.tags.slice(0, 5).map((t) => `#${t.replace(/[^\p{L}\p{N}]/gu, "")}`).filter((t) => t.length > 1).join(" ")]
        .filter(Boolean)
        .join("\n\n");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

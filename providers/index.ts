import { env } from "@/lib/env";
import type { PlatformKey } from "@/lib/platforms";
import type { PlatformConnector, ProductionProvider, PublishingProvider, VoiceProvider } from "@/providers/types";
import { DemoProductionProvider } from "@/providers/demo/production";
import { DemoVoiceProvider } from "@/providers/demo/voice";
import { DemoPublishingProvider } from "@/providers/demo/publishing";
import { N8nProductionProvider } from "@/providers/n8n";
import { ElevenLabsVoiceProvider } from "@/providers/elevenlabs";
import { YouTubePublishingProvider, youtubeConnector } from "@/providers/youtube";
import { InstagramPublishingProvider, instagramConnector } from "@/providers/instagram";
import { TikTokPublishingProvider, tiktokConnector } from "@/providers/tiktok";

/** Auswahl der Provider über Umgebungsvariablen. Demo- und Live-Adapter erfüllen dieselben Verträge. */
export function productionProvider(): ProductionProvider {
  return env().PRODUCTION_PROVIDER === "n8n" ? new N8nProductionProvider() : new DemoProductionProvider();
}
export function voiceProvider(): VoiceProvider {
  return env().VOICE_PROVIDER === "elevenlabs" ? new ElevenLabsVoiceProvider() : new DemoVoiceProvider();
}

/** Veröffentlicht diese Plattform echt („live“) oder nur simuliert? Je Plattform einzeln umschaltbar. */
export function platformPublishMode(platform: PlatformKey): "simulated" | "live" {
  const e = env();
  const live = { youtube: e.PUBLISH_PROVIDER === "youtube", instagram: e.INSTAGRAM_PROVIDER === "instagram", tiktok: e.TIKTOK_PROVIDER === "tiktok" };
  return live[platform] ? "live" : "simulated";
}

export function publishingProvider(platform: PlatformKey): PublishingProvider {
  if (platformPublishMode(platform) === "simulated") return new DemoPublishingProvider(platform);
  if (platform === "instagram") return new InstagramPublishingProvider();
  if (platform === "tiktok") return new TikTokPublishingProvider();
  return new YouTubePublishingProvider();
}

export const CONNECTORS: Record<PlatformKey, PlatformConnector> = { youtube: youtubeConnector, instagram: instagramConnector, tiktok: tiktokConnector };

export function providerModes() {
  const e = env();
  return {
    production: e.PRODUCTION_PROVIDER,
    voice: e.VOICE_PROVIDER,
    publishing: { youtube: platformPublishMode("youtube"), instagram: platformPublishMode("instagram"), tiktok: platformPublishMode("tiktok") },
    billing: e.BILLING_PROVIDER,
    demo: e.DEMO_MODE,
  };
}

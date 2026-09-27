import { env } from "@/lib/env";
import type { ProductionProvider, PublishingProvider, VoiceProvider } from "@/providers/types";
import { DemoProductionProvider } from "@/providers/demo/production";
import { DemoVoiceProvider } from "@/providers/demo/voice";
import { DemoPublishingProvider } from "@/providers/demo/publishing";
import { N8nProductionProvider } from "@/providers/n8n";
import { ElevenLabsVoiceProvider } from "@/providers/elevenlabs";
import { YouTubePublishingProvider } from "@/providers/youtube";

/** Auswahl der Provider über Umgebungsvariablen. Demo- und Live-Adapter erfüllen dieselben Verträge. */
export function productionProvider(): ProductionProvider {
  return env().PRODUCTION_PROVIDER === "n8n" ? new N8nProductionProvider() : new DemoProductionProvider();
}
export function voiceProvider(): VoiceProvider {
  return env().VOICE_PROVIDER === "elevenlabs" ? new ElevenLabsVoiceProvider() : new DemoVoiceProvider();
}
export function publishingProvider(): PublishingProvider {
  return env().PUBLISH_PROVIDER === "youtube" ? new YouTubePublishingProvider() : new DemoPublishingProvider();
}

export function providerModes() {
  const e = env();
  return {
    production: e.PRODUCTION_PROVIDER,
    voice: e.VOICE_PROVIDER,
    publishing: e.PUBLISH_PROVIDER,
    billing: e.BILLING_PROVIDER,
    demo: e.DEMO_MODE,
  };
}

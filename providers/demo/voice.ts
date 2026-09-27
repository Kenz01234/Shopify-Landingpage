import { DEMO_VOICES, findDemoVoice } from "@/lib/voices";
import { ProviderError, type JobContext, type MediaResult, type VoiceProvider } from "@/providers/types";
import { findFixture } from "@/providers/demo/fixtures";

export class DemoVoiceProvider implements VoiceProvider {
  readonly name = "demo" as const;
  readonly mode = "demo" as const;

  async listVoices() {
    return DEMO_VOICES.map((v) => ({ key: v.key, label: v.label, description: v.description, previewAvailable: !!findFixture("audio", { voice: v.key }) }));
  }

  async synthesize(ctx: JobContext): Promise<MediaResult> {
    if (ctx.demoScenario === "permanent_failure") {
      throw new ProviderError("VOICE_QUOTA_EXCEEDED", "Der Stimmen-Dienst meldet: Zeichenkontingent erschöpft (Demo-Szenario).", true, "demo-voice");
    }
    const voice = findDemoVoice(ctx.config.voiceKey) ?? DEMO_VOICES[0];
    const fx = findFixture("audio", { voice: voice.key });
    if (!fx) throw new ProviderError("FIXTURE_MISSING", "Lokale Demo-Hörprobe fehlt.", false, "demo-voice");
    return {
      kind: "audio",
      storageKey: `fixtures/${fx.file}`,
      fileName: `voiceover-demo-${voice.key}.mp3`,
      mimeType: fx.mimeType,
      sizeBytes: fx.sizeBytes,
      durationSec: fx.durationSec,
      origin: "demo_fixture",
      rightsStatus: "public_domain",
      sourceLabel: "Lokale Beispielstimme (Piper, Thorsten-Voice CC0) – spricht einen Beispieltext, nicht dieses Skript",
      license: fx.license,
    };
  }
}

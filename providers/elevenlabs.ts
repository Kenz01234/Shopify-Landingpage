import fs from "node:fs";
import path from "node:path";
import { ProviderError, type JobContext, type MediaResult, type VoiceProvider } from "@/providers/types";
import { env } from "@/lib/env";
import { uploadsDir } from "@/lib/storage";

/**
 * ElevenLabs-Adapter (Live). Schlüssel nur serverseitig; nie loggen.
 * Endpunkte: GET /v2/voices, POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
 * Voice-IDs werden ausschließlich aus der API bzw. der konfigurierten Allowlist übernommen.
 */
const BASE = "https://api.elevenlabs.io";

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = "elevenlabs" as const;
  readonly mode = "live" as const;

  private key() {
    const k = env().ELEVENLABS_API_KEY;
    if (!k) throw new ProviderError("NOT_CONFIGURED", "ELEVENLABS_API_KEY ist nicht gesetzt.", false, "elevenlabs");
    return k;
  }

  async listVoices() {
    const res = await fetch(`${BASE}/v2/voices?page_size=100`, { headers: { "xi-api-key": this.key() }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new ProviderError("ELEVENLABS_VOICES", `Stimmen konnten nicht geladen werden (${res.status}).`, res.status >= 500, "elevenlabs");
    const json = (await res.json()) as { voices?: { voice_id: string; name: string; description?: string; preview_url?: string }[] };
    const allow = (env().ELEVENLABS_VOICE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return (json.voices ?? [])
      .filter((v) => !allow.length || allow.includes(v.voice_id))
      .map((v) => ({ key: v.voice_id, label: v.name, description: v.description, previewAvailable: !!v.preview_url }));
  }

  async synthesize(ctx: JobContext, text: string): Promise<MediaResult> {
    const modelId = env().ELEVENLABS_MODEL_ID;
    if (!modelId) throw new ProviderError("NOT_CONFIGURED", "ELEVENLABS_MODEL_ID ist nicht gesetzt.", false, "elevenlabs");
    let res: Response;
    try {
      res = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(ctx.config.voiceKey)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": this.key(), "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: modelId }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new ProviderError("ELEVENLABS_UNREACHABLE", `ElevenLabs nicht erreichbar: ${(e as Error).message}`, true, "elevenlabs");
    }
    if (res.status === 401) throw new ProviderError("ELEVENLABS_AUTH", "ElevenLabs-Schlüssel ungültig.", false, "elevenlabs");
    if (res.status === 429 || res.status >= 500) throw new ProviderError("ELEVENLABS_BUSY", `ElevenLabs vorübergehend nicht verfügbar (${res.status}).`, true, "elevenlabs");
    if (!res.ok) throw new ProviderError("ELEVENLABS_REJECTED", `ElevenLabs hat die Anfrage abgelehnt (${res.status}).`, false, "elevenlabs");
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = path.join(uploadsDir(), ctx.orgId, ctx.jobId);
    fs.mkdirSync(dir, { recursive: true });
    const file = `voice-r${ctx.revision}-a${ctx.attempt}.mp3`;
    fs.writeFileSync(path.join(dir, file), buf);
    return {
      kind: "audio",
      storageKey: `uploads/${ctx.orgId}/${ctx.jobId}/${file}`,
      fileName: file,
      mimeType: "audio/mpeg",
      sizeBytes: buf.length,
      origin: "elevenlabs",
      rightsStatus: "licensed",
      sourceLabel: "ElevenLabs (gemäß Kontobedingungen)",
    };
  }
}

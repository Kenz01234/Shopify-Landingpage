import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { env } from "@/lib/env";
import { ElevenLabsVoiceProvider } from "@/providers/elevenlabs";

/** Prüft eine Betreiber-Verbindung, ohne Zugangsdaten preiszugeben. */
export const POST = api(async ({ req }) => {
  const { provider } = await parseBody(req, z.object({ provider: z.enum(["elevenlabs"]) }));
  if (provider === "elevenlabs") {
    if (env().VOICE_PROVIDER !== "elevenlabs" || !env().ELEVENLABS_API_KEY) return { ok: false, message: "Nicht konfiguriert – Demo-Stimmen aktiv." };
    try {
      const voices = await new ElevenLabsVoiceProvider().listVoices();
      return { ok: true, message: `Verbunden – ${voices.length} Stimme(n) verfügbar.` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
  return { ok: false };
});

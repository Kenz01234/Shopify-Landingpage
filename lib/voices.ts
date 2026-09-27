/**
 * Stimmenkatalog. Im Demo-Modus sind das lokale Beispielstimmen (Piper/Thorsten-Voice, CC0 –
 * siehe public/media/HERKUNFT.md). Sie sind KEINE ElevenLabs-Stimmen und keine Voice-IDs.
 * Im Live-Modus werden Stimmen ausschließlich aus der konfigurierten ElevenLabs-Auswahl geladen.
 */
export type DemoVoice = {
  key: string;
  label: string;
  description: string;
  sampleFile: string | null;
  language: string;
};

export const DEMO_VOICES: DemoVoice[] = [
  {
    key: "demo-ruhig",
    label: "Ruhig & erzählend (Demo)",
    description: "Männlich, ruhiges Tempo – passt zu Wissen und Dokumentation.",
    sampleFile: "voice-demo-ruhig.mp3",
    language: "de",
  },
  {
    key: "demo-klar",
    label: "Klar & freundlich (Demo)",
    description: "Weiblich, klare Aussprache – passt zu Erklärformaten.",
    sampleFile: "voice-demo-klar.mp3",
    language: "de",
  },
  {
    key: "demo-dynamisch",
    label: "Dynamisch (Demo)",
    description: "Schnelleres Tempo – passt zu Shorts.",
    sampleFile: "voice-demo-dynamisch.mp3",
    language: "de",
  },
];

export function findDemoVoice(key: string) {
  return DEMO_VOICES.find((v) => v.key === key) ?? null;
}

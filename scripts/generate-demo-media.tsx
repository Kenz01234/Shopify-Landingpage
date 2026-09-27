/**
 * Erzeugt die lokalen Demo-Medien unter storage/fixtures/ (bereits im Repository enthalten).
 * Nur nötig, wenn die Medien neu erzeugt werden sollen.
 *
 * Voraussetzungen: ffmpeg, Piper-TTS (`piper` im PATH oder PIPER_BIN) sowie die Stimmen
 * de-thorsten-low / de-kerstin-low (CC0, https://github.com/rhasspy/piper/releases/tag/v0.0.2).
 *
 *   PIPER_BIN=/pfad/zu/piper PIPER_VOICES=/pfad/zu/stimmen npx tsx scripts/generate-demo-media.tsx
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright-core";
import { NicheScene, NICHES, NICHE_ORDER, type NicheKey } from "../components/art/niche-scene";

const OUT = path.resolve("storage/fixtures");
const TMP = path.resolve("storage/tmp/media");
const PIPER = process.env.PIPER_BIN ?? "piper";
const VOICES = process.env.PIPER_VOICES ?? ".";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const voiceModel = (name: "thorsten" | "kerstin") => path.join(VOICES, name, `de-${name}-low.onnx`);

function tts(text: string, voice: "thorsten" | "kerstin", out: string, lengthScale = 1) {
  execFileSync(PIPER, ["-m", voiceModel(voice), "-f", out, "--length_scale", String(lengthScale)], { input: text });
}

function duration(file: string) {
  const s = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  return Math.round(Number(s) * 10) / 10;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function frameHtml(niche: NicheKey, w: number, h: number, title: string, portrait: boolean) {
  const svg = renderToStaticMarkup(<NicheScene niche={niche} />);
  return `<!doctype html><html><head><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:"Inter","Helvetica Neue",Arial,sans-serif}
  .s{position:absolute;inset:0}.s svg{width:100%;height:100%;display:block}
  .g{position:absolute;inset:0;background:${portrait ? "linear-gradient(to top,rgba(0,0,0,.75),rgba(0,0,0,.05) 55%)" : "linear-gradient(to right,rgba(0,0,0,.7),rgba(0,0,0,.1) 60%)"}}
  .t{position:absolute;${portrait ? "left:36px;right:36px;bottom:140px;font-size:54px" : "left:56px;top:50%;transform:translateY(-50%);max-width:560px;font-size:46px"};color:#fff;font-weight:800;text-transform:uppercase;line-height:1.04;letter-spacing:-.01em;text-shadow:0 3px 18px rgba(0,0,0,.45)}
  .b{position:absolute;${portrait ? "left:36px;top:40px" : "left:56px;top:40px"};padding:8px 14px;border-radius:10px;background:rgba(0,0,0,.45);color:#fff;font-size:${portrait ? 24 : 20}px;font-weight:700;letter-spacing:.08em}
  .b i{display:inline-block;width:12px;height:12px;border-radius:50%;background:#e83936;margin-right:10px}
  .f{position:absolute;${portrait ? "left:36px;bottom:70px" : "right:48px;bottom:36px"};color:rgba(255,255,255,.85);font-size:${portrait ? 22 : 18}px;font-weight:600}
  </style></head><body><div class="s">${svg}</div><div class="g"></div>
  <div class="b"><i></i>DEMO · QUEST AGENT</div><div class="t">${esc(title)}</div>
  <div class="f">Beispielvideo – lokal erzeugt, nicht veröffentlicht</div></body></html>`;
}

const HOOKS: Record<NicheKey, { long: string; short: string }> = {
  space: {
    long: "Irgendwo da draußen kreist vielleicht gerade ein Planet, auf dem es regnet. Seit den Neunzigerjahren haben Forschende tausende Planeten außerhalb unseres Sonnensystems nachgewiesen. Dies ist ein Demo-Ausschnitt von Quest Agent.",
    short: "Andere Welten? Tausende Planeten außerhalb unseres Sonnensystems sind bekannt. Demo-Short von Quest Agent.",
  },
  history: {
    long: "Im Jahr neunundsiebzig nach Christus ging für eine ganze Stadt der Alltag abrupt zu Ende. Genau das hat Pompeji über Jahrhunderte konserviert. Dies ist ein Demo-Ausschnitt von Quest Agent.",
    short: "Eine Stadt, konserviert unter Asche. Pompeji in wenigen Sekunden. Demo-Short von Quest Agent.",
  },
  ocean: {
    long: "In viertausend Metern Tiefe ist es kalt und stockdunkel – und trotzdem voller Leben. Viele Tiere machen dort ihr eigenes Licht. Dies ist ein Demo-Ausschnitt von Quest Agent.",
    short: "Leuchten im Dunkeln: Biolumineszenz in der Tiefsee. Demo-Short von Quest Agent.",
  },
  nature: {
    long: "Unter jedem Waldspaziergang liegt ein Netzwerk, das wir kaum wahrnehmen. Pilzfäden verbinden sich mit den Wurzeln vieler Bäume. Dies ist ein Demo-Ausschnitt von Quest Agent.",
    short: "Der Wald hat ein unsichtbares Netzwerk. Demo-Short von Quest Agent.",
  },
  tech: {
    long: "In deinem Handy schalten gerade Milliarden winziger Schalter – immer wieder. Diese Schalter heißen Transistoren. Dies ist ein Demo-Ausschnitt von Quest Agent.",
    short: "Milliarden Schalter in deinem Handy. Demo-Short von Quest Agent.",
  },
};

type Entry = Record<string, unknown>;

async function main() {
  const browser = await chromium.launch();
  const files: Entry[] = [];
  const license =
    "Grafik: eigene Quest-Agent-Demografik (im Code gezeichnet). Stimme: Piper-Modell, Datensatz CC0 (Thorsten-Voice bzw. Kerstin); Basismodell vor kommerzieller Nutzung prüfen. Nur Demo.";

  for (const niche of NICHE_ORDER) {
    for (const portrait of [false, true]) {
      const [w, h] = portrait ? [540, 960] : [960, 540];
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.setContent(frameHtml(niche, w, h, portrait ? NICHES[niche].shortTitle : NICHES[niche].sampleTitle, portrait));
      const png = path.join(TMP, `${niche}-${portrait ? "p" : "l"}.png`);
      await page.screenshot({ path: png });
      await page.close();

      const wav = path.join(TMP, `${niche}-${portrait ? "p" : "l"}.wav`);
      tts(portrait ? HOOKS[niche].short : HOOKS[niche].long, portrait ? "kerstin" : "thorsten", wav, portrait ? 0.95 : 1.05);
      const dur = duration(wav) + 0.8;
      const file = `demo-${niche}-${portrait ? "short" : "landscape"}.mp4`;
      const out = path.join(OUT, file);
      const frames = Math.round(dur * 24);
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error",
        "-loop", "1", "-i", png, "-i", wav,
        "-filter_complex",
        `[0:v]scale=${w * 2}:${h * 2},zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=24,fade=t=in:st=0:d=0.4,fade=t=out:st=${(dur - 0.5).toFixed(2)}:d=0.5,format=yuv420p[v]`,
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-profile:v", "main", "-crf", "30", "-preset", "slow",
        "-c:a", "aac", "-b:a", "64k", "-ar", "44100",
        "-t", dur.toFixed(2), "-movflags", "+faststart", out,
      ]);
      files.push({
        key: `${niche}-${portrait ? "short" : "video"}`,
        file,
        kind: portrait ? "short" : "video",
        mimeType: "video/mp4",
        sizeBytes: fs.statSync(out).size,
        durationSec: duration(out),
        width: w,
        height: h,
        scene: niche,
        license,
        origin: "Quest Agent Demo (scripts/generate-demo-media.tsx)",
      });
      console.log("✓", file);
    }
  }

  const voices = [
    { key: "demo-ruhig", voice: "thorsten" as const, scale: 1.12, text: "Hallo! So klingt die ruhige Demo-Stimme von Quest Agent. Im Live-Betrieb wählst du deine Stimme aus deiner ElevenLabs-Auswahl." },
    { key: "demo-klar", voice: "kerstin" as const, scale: 1.0, text: "Hallo! So klingt die klare Demo-Stimme von Quest Agent. Das ist ein lokales Beispiel und keine ElevenLabs-Stimme." },
    { key: "demo-dynamisch", voice: "kerstin" as const, scale: 0.86, text: "Kurz, schnell, auf den Punkt: So klingt die dynamische Demo-Stimme für Shorts." },
  ];
  for (const v of voices) {
    const wav = path.join(TMP, `${v.key}.wav`);
    tts(v.text, v.voice, wav, v.scale);
    const file = `voice-${v.key}.mp3`;
    const out = path.join(OUT, file);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "64k", "-ar", "22050", out]);
    files.push({
      key: v.key,
      file,
      kind: "audio",
      mimeType: "audio/mpeg",
      sizeBytes: fs.statSync(out).size,
      durationSec: duration(out),
      voice: v.key,
      license: "Piper-Modell, Datensatz CC0 (Thorsten-Voice bzw. Kerstin); Basismodell vor kommerzieller Nutzung prüfen. Nur Demo.",
      origin: "Quest Agent Demo (scripts/generate-demo-media.tsx)",
    });
    console.log("✓", file);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`Manifest mit ${files.length} Dateien geschrieben.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

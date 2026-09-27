import { demoResearch, demoScript, sceneForNiche } from "@/lib/demo/content";
import { ProviderError, type JobContext, type MediaResult, type ProductionProvider } from "@/providers/types";
import { findFixture } from "@/providers/demo/fixtures";

/**
 * Simulierte Produktion: erzeugt Thema, Skript und weist lokale Demo-Medien zu.
 * Fehler-Szenarien lassen sich pro Auftrag im Demo-Modus auswählen.
 */
export class DemoProductionProvider implements ProductionProvider {
  readonly name = "demo" as const;
  readonly mode = "demo" as const;

  async research(ctx: JobContext) {
    return demoResearch(ctx.config, ctx.jobId, ctx.revision, ctx.format);
  }

  async script(ctx: JobContext) {
    return demoScript(ctx.config, ctx.jobId, ctx.revision, ctx.format, ctx.workingData.topic, ctx.revisionNote);
  }

  async render(ctx: JobContext): Promise<MediaResult[]> {
    if (ctx.demoScenario === "transient_failure" && ctx.attempt === 0) {
      throw new ProviderError("RENDER_TIMEOUT", "Der Render-Dienst hat nicht rechtzeitig geantwortet (Demo-Szenario). Automatischer neuer Versuch folgt.", true, "demo-render");
    }
    const scene = ctx.workingData.scene ?? sceneForNiche(ctx.config.niche, ctx.config.name);
    const kind = ctx.format === "short" ? "short" : "video";
    const fx = findFixture(kind, { scene });
    if (!fx) throw new ProviderError("FIXTURE_MISSING", "Lokale Demo-Mediendatei fehlt (scripts/generate-demo-media.mjs ausführen).", false, "demo-render");
    return [
      {
        kind,
        storageKey: `fixtures/${fx.file}`,
        fileName: `${ctx.format === "short" ? "short" : "video"}-demo-${scene}.mp4`,
        mimeType: fx.mimeType,
        sizeBytes: fx.sizeBytes,
        durationSec: fx.durationSec,
        width: fx.width,
        height: fx.height,
        origin: "demo_fixture",
        rightsStatus: "demo_fixture",
        sourceLabel: "Quest-Agent-Demomaterial (lokal erzeugt)",
        license: fx.license,
        editNote: "Demo-Ausschnitt statt vollständiger Produktion",
      },
    ];
  }
}

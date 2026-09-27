import type { PlatformKey } from "@/lib/platforms";
import { ProviderError, type PublishInput, type PublishingProvider, type PublishResult } from "@/providers/types";

const PREFIX: Record<PlatformKey, string> = { youtube: "yt", instagram: "ig", tiktok: "tt" };

/** Simulierte Veröffentlichung je Plattform: es wird nichts hochgeladen. Ergebnis ist ausdrücklich „simulated“. */
export class DemoPublishingProvider implements PublishingProvider {
  readonly name = "demo" as const;
  readonly mode = "demo" as const;
  constructor(readonly platform: PlatformKey) {}

  private id(input: PublishInput) {
    return `demo-${PREFIX[this.platform]}-${input.targetId.slice(-10)}`;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (input.demoFail) {
      throw new ProviderError("DEMO_PLATFORM_ERROR", `Demo-Szenario: ${this.platform === "instagram" ? "Instagram" : this.platform} hat den Upload abgelehnt (Token abgelaufen).`, false, this.platform);
    }
    return { status: "simulated", providerPostId: this.id(input), url: null };
  }

  async reconcile(input: PublishInput) {
    return { status: "published" as const, providerPostId: this.id(input), url: null };
  }
}

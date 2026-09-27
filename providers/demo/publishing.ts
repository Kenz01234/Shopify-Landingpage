import type { PublishInput, PublishingProvider, PublishResult } from "@/providers/types";

/** Simulierte Veröffentlichung: es wird nichts hochgeladen. Ergebnis ist ausdrücklich „simulated“. */
export class DemoPublishingProvider implements PublishingProvider {
  readonly name = "demo" as const;
  readonly mode = "demo" as const;

  async publish(input: PublishInput): Promise<PublishResult> {
    return { status: "simulated", providerVideoId: `demo-${input.publicationId.slice(-10)}` };
  }

  async reconcile(input: PublishInput) {
    return { status: "published" as const, providerVideoId: `demo-${input.publicationId.slice(-10)}` };
  }
}

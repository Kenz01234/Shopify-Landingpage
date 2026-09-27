import type { ContentFormat, RightsStatus } from "@/generated/prisma/client";

/** Fehler eines (echten oder simulierten) Dienstes – mit verständlicher Meldung. */
export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
    public provider: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type SourceNote = {
  id: string;
  type: "fact" | "footage" | "music" | "voice";
  title: string;
  publisher?: string | null;
  url?: string | null;
  note?: string | null;
  rightsStatus: RightsStatus | "not_applicable";
};

export type JobContext = {
  jobId: string;
  orgId: string;
  systemId: string;
  format: ContentFormat;
  attempt: number;
  revision: number;
  revisionNote?: string | null;
  demoScenario: string;
  config: ConfigSnapshot;
  idempotencyKey: string;
  workingData: WorkingData;
};

export type ConfigSnapshot = {
  configVersion: number;
  name: string;
  niche: string;
  topics: string[];
  audience: string;
  language: string;
  tone: string;
  style: string;
  voiceKey: string;
  voiceLabel: string;
  longformMinutes: number;
  shortSeconds: number;
  timezone: string;
  reviewMode: "final_only" | "topic_and_final" | "script_and_final";
  referenceChannels: string[];
};

export type WorkingData = {
  topic?: string;
  proposals?: string[];
  researchSummary?: string;
  sources?: SourceNote[];
  topicApproved?: boolean;
  scriptApproved?: boolean;
  script?: string;
  title?: string;
  description?: string;
  tags?: string[];
  thumbnailText?: string;
  scene?: string;
  audioAssetId?: string;
  generation?: number;
  resumeFrom?: string;
  notes?: string[];
};

export type ResearchResult = { topic: string; proposals: string[]; summary: string; sources: SourceNote[]; scene: string };
export type ScriptResult = { script: string; title: string; description: string; tags: string[]; thumbnailText: string };

export type MediaResult = {
  kind: "video" | "short" | "audio";
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  width?: number;
  height?: number;
  origin: string;
  rightsStatus: RightsStatus;
  sourceLabel?: string;
  license?: string;
  editNote?: string;
};

export interface ProductionProvider {
  readonly name: "demo" | "n8n";
  readonly mode: "demo" | "live";
  /** Live: übergibt den kompletten Auftrag an den externen Workflow. Erst eine Annahmebestätigung zählt als Start. */
  dispatch?(ctx: JobContext): Promise<{ runId: string }>;
  research(ctx: JobContext): Promise<ResearchResult>;
  script(ctx: JobContext): Promise<ScriptResult>;
  render(ctx: JobContext): Promise<MediaResult[]>;
}

export type VoiceInfo = { key: string; label: string; description?: string; previewAvailable: boolean };

export interface VoiceProvider {
  readonly name: "demo" | "elevenlabs";
  readonly mode: "demo" | "live";
  listVoices(): Promise<VoiceInfo[]>;
  synthesize(ctx: JobContext, text: string): Promise<MediaResult>;
}

export type PublishInput = {
  publicationId: string;
  orgId: string;
  title: string;
  description: string;
  tags: string[];
  format: ContentFormat;
  scheduledAt: Date;
  videoStorageKey: string | null;
  connectionId: string | null;
};

export type PublishResult =
  | { status: "simulated"; providerVideoId: string }
  | { status: "published"; providerVideoId: string }
  | { status: "unknown"; detail: string };

export interface PublishingProvider {
  readonly name: "demo" | "youtube";
  readonly mode: "demo" | "live";
  publish(input: PublishInput): Promise<PublishResult>;
  /** Klärt einen unklaren Upload ab – ohne erneut hochzuladen. */
  reconcile(input: PublishInput): Promise<{ status: "published"; providerVideoId: string } | { status: "not_found" } | { status: "unknown" }>;
}

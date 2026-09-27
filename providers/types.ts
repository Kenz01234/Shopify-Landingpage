import type { ContentFormat, RightsStatus } from "@/generated/prisma/client";
import type { PlatformKey } from "@/lib/platforms";

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
  /** Plattformen für Shorts (fehlt in älteren Snapshots → nur YouTube) */
  shortPlatforms?: PlatformKey[];
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
  /** Beitragstext für Instagram/TikTok (Shorts) */
  caption?: string;
  scene?: string;
  audioAssetId?: string;
  generation?: number;
  resumeFrom?: string;
  notes?: string[];
};

export type ResearchResult = { topic: string; proposals: string[]; summary: string; sources: SourceNote[]; scene: string };
export type ScriptResult = { script: string; title: string; description: string; tags: string[]; thumbnailText: string; caption?: string };

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

export type { PlatformKey };

export type PublishInput = {
  /** Plattform-Ziel – dient zugleich als Idempotenz-Markierung beim Abgleich */
  targetId: string;
  publicationId: string;
  orgId: string;
  platform: PlatformKey;
  title: string;
  description: string;
  /** Beitragstext für Instagram/TikTok */
  caption: string;
  tags: string[];
  format: ContentFormat;
  scheduledAt: Date;
  videoStorageKey: string | null;
  /** Nur Instagram: befristeter, signierter HTTPS-Link auf das Video (Instagram lädt es selbst herunter) */
  publicVideoUrl?: string | null;
  connectionId: string | null;
  /** Zwischen-ID eines früheren, unklaren Uploads (Abgleich) */
  uploadId?: string | null;
  /** Wird sofort aufgerufen, sobald die Plattform eine Upload-ID vergibt – damit ein Absturz nie zu einem Doppel-Upload führt */
  onUploadId?: (id: string) => Promise<void>;
  /** Nur Demo: diese Plattform schlägt beim ersten Versuch fehl */
  demoFail?: boolean;
};

export type PublishResult =
  | { status: "simulated" | "published"; providerPostId: string; url?: string | null }
  | { status: "unknown"; detail: string };

export type ReconcileResult = { status: "published"; providerPostId: string; url?: string | null } | { status: "not_found" } | { status: "unknown" };

export interface PublishingProvider {
  readonly platform: PlatformKey;
  readonly name: "demo" | PlatformKey;
  readonly mode: "demo" | "live";
  publish(input: PublishInput): Promise<PublishResult>;
  /** Klärt einen unklaren Upload ab – ohne erneut hochzuladen. */
  reconcile(input: PublishInput): Promise<ReconcileResult>;
}

/** Gespeicherte (verschlüsselte) OAuth-Tokens einer Plattform-Verbindung */
export type StoredTokens = { access_token: string; refresh_token?: string; expires_at: number; refresh_expires_at?: number; user_id?: string };

/** OAuth-Anbindung einer Plattform für die Verbindungsseite */
export interface PlatformConnector {
  readonly platform: PlatformKey;
  readonly scopes: string[];
  configured(): boolean;
  authUrl(state: string, redirectUri: string): string;
  connect(code: string, redirectUri: string): Promise<{ tokens: StoredTokens; accountId: string; accountName: string }>;
  revoke?(tokens: StoredTokens): Promise<void>;
}

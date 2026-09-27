import { z } from "zod";

/**
 * Zentrale, validierte Konfiguration. Wird von Next.js-Server, Worker, Seed und Tests genutzt.
 * Niemals in Client-Komponenten importieren (enthält Geheimnisse).
 */
const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET muss mindestens 32 Zeichen lang sein"),
  CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),

  DEMO_MODE: bool,
  DEMO_PASSWORD: z.string().optional(),
  DEMO_STEP_MS: z.coerce.number().int().min(100).max(60000).default(2500),
  WORKER_TICK_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  SCHEDULER_TICK_MS: z.coerce.number().int().min(500).max(600000).default(5000),
  PLANNING_HORIZON_DAYS: z.coerce.number().int().min(1).max(31).default(7),

  PRODUCTION_PROVIDER: z.enum(["demo", "n8n"]).default("demo"),
  VOICE_PROVIDER: z.enum(["demo", "elevenlabs"]).default("demo"),
  PUBLISH_PROVIDER: z.enum(["demo", "youtube"]).default("demo"),
  BILLING_PROVIDER: z.enum(["demo", "stripe"]).default("demo"),

  N8N_JOB_WEBHOOK_URL: z.string().url().optional(),
  N8N_SHARED_SECRET: z.string().min(32).optional(),
  N8N_EXTERNAL_TIMEOUT_MIN: z.coerce.number().int().min(5).default(240),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().optional(),
  ELEVENLABS_VOICE_IDS: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_STUDIO: z.string().optional(),

  ASSET_DOWNLOAD_ALLOWED_HOSTS: z.string().optional(),
  ASSET_DOWNLOAD_MAX_MB: z.coerce.number().int().min(1).max(4096).default(1024),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Ungültige Umgebungskonfiguration:\n${issues}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production" && e.DEMO_MODE && process.env.ALLOW_DEMO_IN_PRODUCTION !== "true") {
    throw new Error(
      "DEMO_MODE ist in NODE_ENV=production aktiv. Für eine lokale Produktions-Vorschau ALLOW_DEMO_IN_PRODUCTION=true setzen – niemals im echten Betrieb.",
    );
  }
  cached = e;
  return e;
}

export const isDemoMode = () => env().DEMO_MODE;
export const appUrl = () => env().APP_URL.replace(/\/$/, "");

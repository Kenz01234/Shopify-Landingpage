import { ProviderError, type JobContext, type ProductionProvider } from "@/providers/types";
import { signPayload } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";

/**
 * n8n-Adapter (Live). Übergibt einen Auftrag an einen konfigurierten n8n-Webhook.
 * Es wird KEINE Workflow-ID angenommen und kein produktiver Workflow verändert.
 *
 * Vertrag (siehe docs/INTEGRATIONEN.md):
 *  Anfrage  POST N8N_JOB_WEBHOOK_URL, Header X-Quest-Timestamp, X-Quest-Signature (HMAC-SHA256 über „ts.body“),
 *           Idempotency-Key. Body: { jobId, orgId, systemId, format, attempt, revision, revisionNote, config,
 *           topic?, script?, callbackUrl }
 *  Antwort  2xx + JSON { "accepted": true, "runId": "<eindeutig>" } – nur das zählt als bestätigter Start.
 *  Rückmeldungen per POST {callbackUrl} (gleiche Signatur), siehe app/api/webhooks/n8n/route.ts.
 */
export class N8nProductionProvider implements ProductionProvider {
  readonly name = "n8n" as const;
  readonly mode = "live" as const;

  async dispatch(ctx: JobContext) {
    const e = env();
    if (!e.N8N_JOB_WEBHOOK_URL || !e.N8N_SHARED_SECRET) {
      throw new ProviderError("NOT_CONFIGURED", "n8n ist nicht konfiguriert (N8N_JOB_WEBHOOK_URL / N8N_SHARED_SECRET fehlen).", false, "n8n");
    }
    const body = JSON.stringify({
      jobId: ctx.jobId,
      orgId: ctx.orgId,
      systemId: ctx.systemId,
      format: ctx.format,
      attempt: ctx.attempt,
      revision: ctx.revision,
      revisionNote: ctx.revisionNote ?? null,
      config: ctx.config,
      topic: ctx.workingData.topicApproved ? ctx.workingData.topic : null,
      script: ctx.workingData.scriptApproved ? ctx.workingData.script : null,
      callbackUrl: `${appUrl()}/api/webhooks/n8n`,
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    let res: Response;
    try {
      res = await fetch(e.N8N_JOB_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-quest-timestamp": ts,
          "x-quest-signature": `sha256=${signPayload(e.N8N_SHARED_SECRET, ts, body)}`,
          "idempotency-key": `${ctx.idempotencyKey}:a${ctx.attempt}:r${ctx.revision}`,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new ProviderError("N8N_UNREACHABLE", `n8n nicht erreichbar: ${(err as Error).message}`, true, "n8n");
    }
    if (res.status === 401 || res.status === 403) throw new ProviderError("N8N_AUTH", "n8n hat die Anfrage abgelehnt (Authentifizierung).", false, "n8n");
    if (res.status >= 500 || res.status === 429) throw new ProviderError("N8N_UNAVAILABLE", `n8n antwortet mit ${res.status}.`, true, "n8n");
    if (!res.ok) throw new ProviderError("N8N_REJECTED", `n8n hat den Auftrag abgelehnt (${res.status}).`, false, "n8n");
    const json = (await res.json().catch(() => null)) as { accepted?: boolean; runId?: string } | null;
    if (!json?.accepted || !json.runId) {
      throw new ProviderError("N8N_NOT_ACCEPTED", "n8n hat keine Annahme bestätigt („accepted“ + „runId“ fehlen).", true, "n8n");
    }
    return { runId: String(json.runId).slice(0, 200) };
  }

  async research(): Promise<never> {
    throw new ProviderError("LIVE_EXTERNAL", "Im Live-Modus führt n8n diesen Schritt aus.", false, "n8n");
  }
  async script(): Promise<never> {
    throw new ProviderError("LIVE_EXTERNAL", "Im Live-Modus führt n8n diesen Schritt aus.", false, "n8n");
  }
  async render(): Promise<never> {
    throw new ProviderError("LIVE_EXTERNAL", "Im Live-Modus führt n8n diesen Schritt aus.", false, "n8n");
  }
}

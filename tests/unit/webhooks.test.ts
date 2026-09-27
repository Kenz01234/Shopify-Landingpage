import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { signPayload } from "@/lib/crypto";
import { handleN8nCallback } from "@/lib/webhooks/n8n";
import { handleStripeWebhook } from "@/lib/webhooks/stripe";
import { createSystem } from "@/lib/systems";
import { createManualJob } from "@/lib/jobs/service";
import { makeCustomer, systemInput } from "./helpers";

const SECRET = "n8n-test-secret-n8n-test-secret-0123456789";
function signed(body: object) {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const h = new Headers({ "x-quest-timestamp": ts, "x-quest-signature": `sha256=${signPayload(SECRET, ts, raw)}` });
  return { raw, h };
}

async function externalJob() {
  const c = await makeCustomer();
  const system = await createSystem(c.ctx, systemInput());
  const { job } = await createManualJob(c.ctx, { systemId: system.id, format: "longform", clientKey: crypto.randomUUID() });
  await prisma.productionJob.update({ where: { id: job.id }, data: { status: "researching", awaitingExternal: true, externalRunId: "run-1", externalAcceptedAt: new Date() } });
  return { ...c, job };
}

describe("n8n-Rückmeldungen", () => {
  it("weist falsche Signaturen ab", async () => {
    const { raw } = signed({ a: 1 });
    const r = await handleN8nCallback(raw, new Headers({ "x-quest-timestamp": "1", "x-quest-signature": "sha256=00" }));
    expect(r.httpStatus).toBe(401);
  });

  it("verarbeitet Status und Ergebnis, ignoriert Duplikate, verspätete Meldungen und fremde Läufe", async () => {
    const { job } = await externalJob();
    const e1 = signed({ eventId: "evt-aaaa-1", jobId: job.id, runId: "run-1", seq: 1, type: "status", status: "scripting" });
    expect((await handleN8nCallback(e1.raw, e1.h)).body.status).toBe("processed");
    expect((await handleN8nCallback(e1.raw, e1.h)).body.duplicate).toBe(true);
    const late = signed({ eventId: "evt-aaaa-0", jobId: job.id, runId: "run-1", seq: 1, type: "status", status: "researching" });
    expect((await handleN8nCallback(late.raw, late.h)).body.status).toBe("ignored");
    const foreign = signed({ eventId: "evt-bbbb-1", jobId: job.id, runId: "run-alt", seq: 5, type: "status", status: "rendering" });
    expect((await handleN8nCallback(foreign.raw, foreign.h)).body.note).toMatch(/Veralteter Lauf/);
    const result = signed({
      eventId: "evt-aaaa-2",
      jobId: job.id,
      runId: "run-1",
      seq: 2,
      type: "result",
      result: { topic: "T", title: "Titel", description: "Beschreibung genug lang", script: "Skript", tags: ["a"], thumbnailText: "X", sources: [], media: [] },
    });
    expect((await handleN8nCallback(result.raw, result.h)).body.status).toBe("processed");
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("quality_check");
    expect(j.awaitingExternal).toBe(false);
    const after = signed({ eventId: "evt-aaaa-3", jobId: job.id, runId: "run-1", seq: 3, type: "status", status: "rendering" });
    expect((await handleN8nCallback(after.raw, after.h)).body.status).toBe("ignored");
  });

  it("wiederholt nach Providerfehler mit Backoff – ohne neue Kontingentbuchung", async () => {
    const { job, org } = await externalJob();
    const e = signed({ eventId: "evt-cccc-1", jobId: job.id, runId: "run-1", seq: 1, type: "error", error: { code: "TTS", message: "Stimme nicht erreichbar", retryable: true } });
    await handleN8nCallback(e.raw, e.h);
    const j = await prisma.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("retry_scheduled");
    expect(j.retryStep).toBe("queued");
    expect(await prisma.quotaEntry.count({ where: { organizationId: org.id, action: "reserve" } })).toBe(1);
  });
});

describe("Stripe-Webhooks", () => {
  const secret = "whsec_test_secret_for_signature_checks";
  const stripe = new Stripe("sk_test_dummy");
  const sign = (payload: string) => stripe.webhooks.generateTestHeaderString({ payload, secret });
  const subEvent = (id: string, orgId: string, created: number, status: string, cancel = false) =>
    JSON.stringify({
      id,
      object: "event",
      type: "customer.subscription.updated",
      created,
      data: {
        object: {
          id: "sub_123",
          object: "subscription",
          status,
          customer: "cus_123",
          cancel_at_period_end: cancel,
          metadata: { orgId },
          items: { data: [{ price: { id: "price_test_studio" }, current_period_start: created, current_period_end: created + 30 * 86400 }] },
        },
      },
    });

  it("vergibt Zugang nur über signierte Ereignisse, idempotent und in richtiger Reihenfolge", async () => {
    const { org } = await makeCustomer({ withSub: false });
    const bad = await handleStripeWebhook(subEvent("evt_1", org.id, 1_800_000_000, "active"), "t=1,v1=falsch");
    expect(bad.httpStatus).toBe(400);
    expect(await prisma.subscription.findUnique({ where: { organizationId: org.id } })).toBeNull();

    const p1 = subEvent("evt_1", org.id, 1_800_000_100, "active");
    expect((await handleStripeWebhook(p1, sign(p1))).body.status).toBe("processed");
    expect((await handleStripeWebhook(p1, sign(p1))).body.duplicate).toBe(true);
    let sub = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: org.id } });
    expect(sub.status).toBe("active");
    expect(sub.plan).toBe("studio");

    const older = subEvent("evt_0", org.id, 1_800_000_050, "canceled");
    await handleStripeWebhook(older, sign(older));
    sub = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: org.id } });
    expect(sub.status).toBe("active");

    const failed = subEvent("evt_2", org.id, 1_800_000_200, "past_due");
    await handleStripeWebhook(failed, sign(failed));
    sub = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: org.id } });
    expect(sub.status).toBe("past_due");
  });
});

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { claimAllowed, claimShopifyOrdersForUser, handleShopifyWebhook } from "@/lib/billing/shopify";
import { changePlan } from "@/lib/billing/service";
import { isEntitled } from "@/lib/billing/subscription";
import { makeCustomer } from "./helpers";

const SECRET = "shopify-test-signing-secret";
const SHOP = "quest-test.myshopify.com";

function hook(topic: string, body: object, opts: { webhookId?: string; secret?: string; shop?: string } = {}) {
  const raw = JSON.stringify(body);
  const hmac = crypto.createHmac("sha256", opts.secret ?? SECRET).update(raw, "utf8").digest("base64");
  const headers = new Headers({
    "x-shopify-hmac-sha256": hmac,
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": opts.shop ?? SHOP,
    "x-shopify-webhook-id": opts.webhookId ?? crypto.randomUUID(),
  });
  return handleShopifyWebhook(raw, headers);
}

let orderSeq = 5000;
const order = (email: string, sku: string, processedAt: string, extra: Record<string, unknown> = {}) => ({
  id: ++orderSeq,
  name: `#${orderSeq}`,
  email,
  created_at: processedAt,
  processed_at: processedAt,
  line_items: [{ sku, variant_id: 99, title: "Quest Agent", quantity: 1 }],
  ...extra,
});

async function subOf(orgId: string) {
  return prisma.subscription.findUnique({ where: { organizationId: orgId } });
}

describe("Shopify: Kauf schaltet das Abo frei", () => {
  it("prüft Signatur und Shop-Domain", async () => {
    const { user, org } = await makeCustomer({ withSub: false });
    const o = order(user.email, "QA-STUDIO", "2026-09-01T10:00:00Z");
    expect((await hook("orders/paid", o, { secret: "falsch" })).httpStatus).toBe(401);
    expect((await hook("orders/paid", o, { shop: "fremder-shop.myshopify.com" })).httpStatus).toBe(401);
    expect(await subOf(org.id)).toBeNull();
  });

  it("aktiviert den gekauften Plan für ein bestehendes Konto – idempotent", async () => {
    const { user, org } = await makeCustomer({ withSub: false });
    const o = order(user.email.toUpperCase(), "QA-STUDIO", new Date(Date.now() - 3600_000).toISOString());
    const r = await hook("orders/paid", o, { webhookId: "wh-1" });
    expect(r.body).toMatchObject({ status: "processed", result: "applied" });
    const sub = (await subOf(org.id))!;
    expect(sub).toMatchObject({ plan: "studio", status: "active", provider: "shopify" });
    expect(isEntitled(sub, new Date())).toBe(true);
    expect(sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()).toBeGreaterThan(27 * 86400_000);
    // Gleiche Zustellung erneut und dieselbe Bestellung über eine neue Zustellung
    expect((await hook("orders/paid", o, { webhookId: "wh-1" })).body).toMatchObject({ duplicate: true });
    expect((await hook("orders/paid", o, { webhookId: "wh-2" })).body).toMatchObject({ status: "ignored" });
    expect(await prisma.shopifyOrder.count({ where: { orderId: String(o.id) } })).toBe(1);
  });

  it("erkennt den Plan auch über die Varianten-ID und ignoriert Bestellungen ohne Plan", async () => {
    const a = await makeCustomer({ withSub: false });
    await hook("orders/paid", { ...order(a.user.email, "ANDERES-PRODUKT", new Date().toISOString()), line_items: [{ sku: null, variant_id: 4711 }] });
    expect((await subOf(a.org.id))?.plan).toBe("studio");
    const b = await makeCustomer({ withSub: false });
    const r = await hook("orders/paid", order(b.user.email, "T-SHIRT", new Date().toISOString()));
    expect(r.body).toMatchObject({ status: "ignored" });
    expect(await subOf(b.org.id)).toBeNull();
  });

  it("Kauf vor der Registrierung wartet und wird beim Registrieren übernommen", async () => {
    const email = `kauf-${crypto.randomUUID()}@test.local`;
    const r = await hook("orders/paid", order(email, "QA-STARTER", new Date().toISOString()));
    expect(r.body).toMatchObject({ result: "waiting" });
    const { user, org } = await makeCustomer({ withSub: false });
    await prisma.user.update({ where: { id: user.id }, data: { email } });
    expect(await claimShopifyOrdersForUser({ id: user.id, email, emailVerified: false })).toBe(1);
    expect(await subOf(org.id)).toMatchObject({ plan: "starter", provider: "shopify", status: "active" });
    expect(await claimShopifyOrdersForUser({ id: user.id, email, emailVerified: false })).toBe(0);
  });

  it("außerhalb des Demo-Modus nur mit bestätigter E-Mail-Adresse", () => {
    expect(claimAllowed(false, false)).toBe(false);
    expect(claimAllowed(true, false)).toBe(true);
  });

  it("Folgebestellungen verlängern, verspätete ältere Bestellungen ändern nichts", async () => {
    const { user, org } = await makeCustomer({ withSub: false });
    const first = new Date(Date.now() - 20 * 86400_000);
    const second = new Date(Date.now() - 1 * 86400_000);
    await hook("orders/paid", order(user.email, "QA-STARTER", first.toISOString()));
    await hook("orders/paid", order(user.email, "QA-STUDIO", second.toISOString()));
    const after = (await subOf(org.id))!;
    expect(after.plan).toBe("studio");
    expect(after.currentPeriodStart.toISOString()).toBe(second.toISOString());
    const late = new Date(Date.now() - 40 * 86400_000);
    await hook("orders/paid", order(user.email, "QA-STARTER", late.toISOString()));
    expect((await subOf(org.id))!.plan).toBe("studio");
  });

  it("Stornierung beendet den Zugang aus dieser Bestellung", async () => {
    const { user, org } = await makeCustomer({ withSub: false });
    const o = order(user.email, "QA-STARTER", new Date(Date.now() - 86400_000).toISOString());
    await hook("orders/paid", o);
    expect(isEntitled(await subOf(org.id), new Date())).toBe(true);
    await hook("orders/cancelled", { ...o, cancelled_at: new Date().toISOString() });
    const sub = await subOf(org.id);
    expect(sub?.status).toBe("canceled");
    expect(isEntitled(sub, new Date())).toBe(false);
  });

  it("über den Shop gekaufte Abos lassen sich nicht in der App ändern", async () => {
    const { user, org, ctx } = await makeCustomer({ withSub: false });
    await hook("orders/paid", order(user.email, "QA-STARTER", new Date().toISOString()));
    await expect(changePlan(ctx, "studio")).rejects.toMatchObject({ code: "MANAGED_IN_SHOP" });
    expect((await subOf(org.id))!.plan).toBe("starter");
  });
});

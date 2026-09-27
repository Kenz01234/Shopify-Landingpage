import crypto from "node:crypto";
import { z } from "zod";
import type { PlanKey, Prisma, ShopifyOrder } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { isUniqueViolation } from "@/lib/errors";
import { addMonthsUtc } from "@/lib/time";
import { audit } from "@/lib/audit";
import { syncCounterLimits } from "@/lib/quota";

/**
 * Shopify als Verkaufsweg: Ein bezahlter Kauf (Webhook orders/paid) schaltet den Plan in der App frei.
 * - Echtheit: HMAC-SHA256 über den unveränderten Body (X-Shopify-Hmac-Sha256) + erwartete Shop-Domain
 * - Idempotenz: X-Shopify-Webhook-Id; jede Bestellung nur einmal (shopDomain + orderId)
 * - Plan: über SKU oder Varianten-ID (SHOPIFY_PLAN_STARTER / SHOPIFY_PLAN_STUDIO); Studio schlägt Starter
 * - Zuordnung über die E-Mail-Adresse – nur zu Konten mit BESTÄTIGTER E-Mail (außer im lokalen Demo-Modus),
 *   damit niemand einen fremden Kauf übernimmt, indem er sich mit der Käufer-Adresse registriert.
 * - Wiederkehrende Abo-Bestellungen (z. B. Shopify Subscriptions) verlängern jeweils um einen Monat.
 * - orders/cancelled beendet den Zugang, wenn der aktuelle Zeitraum aus dieser Bestellung stammt.
 */

export function verifyShopifyHmac(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const id = z.union([z.number(), z.string()]).transform(String);
const orderSchema = z
  .object({
    id,
    name: z.string().nullish(),
    email: z.string().nullish(),
    contact_email: z.string().nullish(),
    customer: z.object({ email: z.string().nullish(), id: id.nullish() }).passthrough().nullish(),
    created_at: z.string(),
    processed_at: z.string().nullish(),
    line_items: z
      .array(z.object({ sku: z.string().nullish(), variant_id: id.nullish(), title: z.string().nullish(), quantity: z.number().nullish() }).passthrough())
      .default([]),
  })
  .passthrough();
type OrderPayload = z.infer<typeof orderSchema>;

const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Welcher Plan steckt in der Bestellung? (null = kein Quest-Agent-Plan) */
export function planForOrder(order: Pick<OrderPayload, "line_items">): PlanKey | null {
  const e = env();
  const studio = list(e.SHOPIFY_PLAN_STUDIO);
  const starter = list(e.SHOPIFY_PLAN_STARTER);
  const matches = (keys: string[]) => order.line_items.some((li) => (li.sku && keys.includes(li.sku)) || (li.variant_id && keys.includes(li.variant_id)));
  if (matches(studio)) return "studio";
  if (matches(starter)) return "starter";
  return null;
}

/** Zuordnung nur mit bestätigter E-Mail – im lokalen Demo-Modus (ohne Mailversand) auch unbestätigt. */
export const claimAllowed = (emailVerified: boolean, demo = isDemoMode()) => emailVerified || demo;

const normEmail = (o: OrderPayload) => (o.email || o.contact_email || o.customer?.email || "").trim().toLowerCase();

/** Konto zur E-Mail – nur mit bestätigter Adresse (Demo-Modus: auch unbestätigt). */
async function orgForEmail(db: Tx | typeof prisma, email: string) {
  if (!email) return null;
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
  if (!user || !claimAllowed(user.emailVerified)) return null;
  const m = user.memberships.find((x) => x.role === "owner") ?? user.memberships[0];
  return m ? { orgId: m.organizationId, userId: user.id } : null;
}

/** Überträgt einen bezahlten Kauf auf das Abo der Organisation. Ältere Bestellungen überschreiben keine neueren. */
export async function applyShopifyOrder(tx: Tx, order: ShopifyOrder, orgId: string): Promise<"applied" | "older" | "conflict"> {
  const sub = await tx.subscription.findUnique({ where: { organizationId: orgId } });
  if (sub && sub.provider === "stripe" && sub.status === "active" && sub.currentPeriodEnd > new Date()) {
    await audit(tx, { orgId, actor: { type: "system" }, action: "notice", meta: { message: `Kauf ${order.orderName ?? order.orderId} im Shop trotz aktivem Stripe-Abo – bitte prüfen (keine automatische Änderung).` } });
    return "conflict";
  }
  if (sub?.provider === "shopify" && sub.lastProviderEventAt && sub.lastProviderEventAt > order.periodStart) return "older";
  const periodEnd = sub?.provider === "shopify" && sub.status === "active" && sub.currentPeriodEnd > order.periodEnd ? sub.currentPeriodEnd : order.periodEnd;
  const data = {
    plan: order.plan,
    status: "active" as const,
    provider: "shopify" as const,
    currentPeriodStart: order.periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    pendingPlan: null,
    demoFailNextRenewal: false,
    lastProviderEventAt: order.periodStart,
  };
  const saved = await tx.subscription.upsert({ where: { organizationId: orgId }, create: { organizationId: orgId, ...data }, update: data });
  await syncCounterLimits(tx, orgId, saved);
  await tx.shopifyOrder.update({ where: { id: order.id }, data: { organizationId: orgId, claimedAt: order.claimedAt ?? new Date() } });
  await audit(tx, { orgId, actor: { type: "system" }, action: "billing.shopify.order", targetType: "shopify_order", targetId: order.id, meta: { order: order.orderName, plan: order.plan } });
  return "applied";
}

/** Nach Registrierung oder E-Mail-Bestätigung: noch nicht zugeordnete Käufe dieser Adresse übernehmen. */
export async function claimShopifyOrdersForUser(user: { id: string; email: string; emailVerified: boolean }): Promise<number> {
  if (!claimAllowed(user.emailVerified)) return 0;
  const orders = await prisma.shopifyOrder.findMany({
    where: { email: user.email.trim().toLowerCase(), status: "paid", organizationId: null, periodEnd: { gt: new Date() } },
    orderBy: { periodStart: "asc" },
  });
  if (!orders.length) return 0;
  const m = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (!m) return 0;
  let n = 0;
  for (const o of orders) {
    await prisma.$transaction(async (tx) => {
      if ((await applyShopifyOrder(tx, o, m.organizationId)) !== "conflict") n++;
    });
  }
  return n;
}

export async function handleShopifyWebhook(raw: string, headers: Headers): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const e = env();
  if (!e.SHOPIFY_WEBHOOK_SECRET || !e.SHOPIFY_SHOP_DOMAIN) return { httpStatus: 503, body: { error: "Shopify-Webhook nicht konfiguriert" } };
  if (!verifyShopifyHmac(raw, headers.get("x-shopify-hmac-sha256"), e.SHOPIFY_WEBHOOK_SECRET)) return { httpStatus: 401, body: { error: "Signatur ungültig" } };
  if ((headers.get("x-shopify-shop-domain") ?? "").toLowerCase() !== e.SHOPIFY_SHOP_DOMAIN) return { httpStatus: 401, body: { error: "Unbekannter Shop" } };
  const topic = headers.get("x-shopify-topic") ?? "";
  const webhookId = headers.get("x-shopify-webhook-id");
  if (!webhookId) return { httpStatus: 400, body: { error: "Webhook-ID fehlt" } };

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { httpStatus: 400, body: { error: "Ungültiges JSON" } };
  }
  let rowId: string;
  try {
    const row = await prisma.webhookEvent.create({ data: { provider: "shopify", eventId: webhookId, eventType: topic, payload: payload as Prisma.InputJsonValue } });
    rowId = row.id;
  } catch (err) {
    if (isUniqueViolation(err)) return { httpStatus: 200, body: { duplicate: true } };
    throw err;
  }
  const done = async (status: "processed" | "ignored", note?: string) => {
    await prisma.webhookEvent.update({ where: { id: rowId }, data: { status, error: note ?? null, processedAt: new Date() } });
    return { httpStatus: 200, body: { status, note } };
  };

  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) return done("ignored", "Keine Bestellung");
  const order = parsed.data;

  if (topic === "orders/paid") {
    const plan = planForOrder(order);
    if (!plan) return done("ignored", "Kein Quest-Agent-Plan in der Bestellung");
    const email = normEmail(order);
    if (!email) return done("ignored", "Bestellung ohne E-Mail-Adresse");
    const start = new Date(order.processed_at ?? order.created_at);
    const known = await prisma.shopifyOrder.findUnique({ where: { shopDomain_orderId: { shopDomain: e.SHOPIFY_SHOP_DOMAIN, orderId: order.id } } });
    if (known) return done("ignored", "Bestellung bereits verarbeitet");
    return prisma.$transaction(async (tx) => {
      const row = await tx.shopifyOrder.create({
        data: { shopDomain: e.SHOPIFY_SHOP_DOMAIN!, orderId: order.id, orderName: order.name ?? null, email, plan, periodStart: start, periodEnd: addMonthsUtc(start, 1), status: "paid" },
      });
      const target = await orgForEmail(tx, email);
      const result = target ? await applyShopifyOrder(tx, row, target.orgId) : "waiting";
      await tx.webhookEvent.update({
        where: { id: rowId },
        data: { status: "processed", error: result === "waiting" ? "Wartet auf Registrierung mit dieser (bestätigten) E-Mail" : result, processedAt: new Date() },
      });
      return { httpStatus: 200, body: { status: "processed", result } };
    });
  }

  if (topic === "orders/cancelled") {
    const row = await prisma.shopifyOrder.findUnique({ where: { shopDomain_orderId: { shopDomain: e.SHOPIFY_SHOP_DOMAIN, orderId: order.id } } });
    if (!row) return done("ignored", "Unbekannte oder keine Plan-Bestellung");
    await prisma.$transaction(async (tx) => {
      await tx.shopifyOrder.update({ where: { id: row.id }, data: { status: "cancelled" } });
      if (!row.organizationId) return;
      const sub = await tx.subscription.findUnique({ where: { organizationId: row.organizationId } });
      if (sub?.provider === "shopify" && sub.currentPeriodStart.getTime() === row.periodStart.getTime()) {
        const now = new Date();
        await tx.subscription.update({ where: { id: sub.id }, data: { status: "canceled", canceledAt: now, currentPeriodEnd: now } });
        await audit(tx, { orgId: row.organizationId, actor: { type: "system" }, action: "billing.shopify.cancelled", targetType: "shopify_order", targetId: row.id });
      }
    });
    return done("processed");
  }

  return done("ignored", "Nicht benötigtes Ereignis");
}

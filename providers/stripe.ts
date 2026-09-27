import Stripe from "stripe";
import type { PlanKey, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { appUrl, env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { syncCounterLimits } from "@/lib/quota";
import { audit } from "@/lib/audit";

/**
 * Stripe-Adapter (vorbereitet; ohne Testschlüssel ungetestet gegen die echte API).
 * Zugang wird NIE aus einer Browser-Erfolgs-URL vergeben: maßgeblich sind ausschließlich
 * signaturgeprüfte Webhooks (customer.subscription.*), idempotent über WebhookEvent.
 * Seit API-Version 2025-03-31 („basil“) liegen current_period_start/end an den Subscription-Items.
 */
let client: Stripe | null = null;
export function stripe() {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new AppError("NOT_CONFIGURED", "Stripe ist nicht konfiguriert.", 503);
  if (key.startsWith("sk_live_") && process.env.ALLOW_STRIPE_LIVE !== "true") {
    throw new AppError("LIVE_KEY_BLOCKED", "Live-Schlüssel sind gesperrt, bis ALLOW_STRIPE_LIVE=true bewusst gesetzt wird.", 503);
  }
  client ??= new Stripe(key);
  return client;
}

export function priceFor(plan: PlanKey) {
  const e = env();
  const id = plan === "starter" ? e.STRIPE_PRICE_STARTER : e.STRIPE_PRICE_STUDIO;
  if (!id) throw new AppError("NOT_CONFIGURED", `Stripe-Preis für ${plan} fehlt (STRIPE_PRICE_${plan.toUpperCase()}).`, 503);
  return id;
}

export function planForPrice(priceId: string | undefined | null): PlanKey | null {
  const e = env();
  if (priceId && priceId === e.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === e.STRIPE_PRICE_STUDIO) return "studio";
  return null;
}

export async function createCheckout(orgId: string, email: string, plan: PlanKey) {
  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceFor(plan), quantity: 1 }],
    client_reference_id: orgId,
    customer: sub?.providerCustomerId ?? undefined,
    customer_email: sub?.providerCustomerId ? undefined : email,
    metadata: { orgId, plan },
    subscription_data: { metadata: { orgId } },
    success_url: `${appUrl()}/app/abo?checkout=pruefen`,
    cancel_url: `${appUrl()}/app/abo?checkout=abgebrochen`,
  });
  return session.url!;
}

export async function createPortal(orgId: string) {
  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub?.providerCustomerId) throw new AppError("NO_CUSTOMER", "Noch kein Stripe-Kundenkonto verknüpft.", 409);
  const s = await stripe().billingPortal.sessions.create({ customer: sub.providerCustomerId, return_url: `${appUrl()}/app/abo` });
  return s.url;
}

export function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "incomplete";
    default:
      return "canceled";
  }
}

type SubLike = {
  id: string;
  status: Stripe.Subscription.Status;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  items: { data: { price: { id: string }; current_period_start?: number; current_period_end?: number }[] };
  current_period_start?: number;
  current_period_end?: number;
};

export function periodOf(sub: SubLike) {
  const item = sub.items.data[0];
  const start = item?.current_period_start ?? sub.current_period_start;
  const end = item?.current_period_end ?? sub.current_period_end;
  return { start: start ? new Date(start * 1000) : null, end: end ? new Date(end * 1000) : null };
}

/** Überträgt den Stripe-Stand auf das lokale Abo – mit Reihenfolgeschutz über event.created. */
export async function syncSubscriptionFromStripe(sub: SubLike, eventCreated: number) {
  const orgId = sub.metadata?.orgId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const existing =
    (await prisma.subscription.findUnique({ where: { providerSubscriptionId: sub.id } })) ??
    (orgId ? await prisma.subscription.findUnique({ where: { organizationId: orgId } }) : null);
  const targetOrg = existing?.organizationId ?? orgId;
  if (!targetOrg) return { ignored: "unbekannte Organisation" };
  const eventAt = new Date(eventCreated * 1000);
  if (existing?.lastProviderEventAt && existing.lastProviderEventAt.getTime() > eventAt.getTime()) {
    return { ignored: "älteres Ereignis" };
  }
  const plan = planForPrice(sub.items.data[0]?.price.id);
  if (!plan) return { ignored: "unbekannter Preis" };
  const { start, end } = periodOf(sub);
  if (!start || !end) return { ignored: "keine Periode" };
  const data = {
    plan,
    status: mapStatus(sub.status),
    provider: "stripe" as const,
    providerCustomerId: customerId,
    providerSubscriptionId: sub.id,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    lastProviderEventAt: eventAt,
    pendingPlan: null,
  };
  const saved = await prisma.subscription.upsert({
    where: { organizationId: targetOrg },
    create: { organizationId: targetOrg, ...data },
    update: data,
  });
  await syncCounterLimits(prisma, targetOrg, saved);
  await audit(prisma, { orgId: targetOrg, actor: { type: "webhook" }, action: "billing.stripe_sync", targetType: "subscription", targetId: saved.id, meta: { status: saved.status, plan } });
  return { synced: saved.id };
}

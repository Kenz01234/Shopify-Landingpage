import type { PlanKey, Subscription } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { orgNow } from "@/lib/clock";
import { addMonthsUtc } from "@/lib/time";
import { syncCounterLimits } from "@/lib/quota";
import { audit } from "@/lib/audit";
import { env, isDemoMode } from "@/lib/env";
import { PLANS } from "@/lib/plans";
import type { Ctx } from "@/lib/jobs/service";

/**
 * Abo-Verwaltung. Im Demo-Modus werden alle Vorgänge serverseitig simuliert (keine Zahlung).
 * Mit BILLING_PROVIDER=stripe übernimmt Stripe Checkout/Portal; der Abo-Status wird dann
 * ausschließlich aus verifizierten Webhooks übernommen (providers/stripe.ts).
 */

export const PLAN_RANK: Record<PlanKey, number> = { starter: 1, studio: 2 };

async function orgWithSub(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, include: { subscription: true } });
  if (!org) throw new AppError("NOT_FOUND", "Organisation nicht gefunden.", 404);
  return org;
}

function assertDemoBilling() {
  if (env().BILLING_PROVIDER !== "demo") throw new AppError("NOT_DEMO", "Diese Aktion ist nur im Demo-Billing verfügbar.", 400);
}

/** Über den Shop gekaufte Abos werden dort verwaltet – sonst liefen App und Shop auseinander. */
function assertNotShopManaged(sub: { provider: string } | null | undefined) {
  if (sub?.provider === "shopify") {
    throw new AppError("MANAGED_IN_SHOP", "Dein Abo läuft über den Shop. Planwechsel und Kündigung bitte im Kundenkonto des Shops vornehmen.", 409);
  }
}

/** Demo-Checkout: aktiviert oder wechselt den Plan ohne Zahlung. */
export async function demoCheckout(ctx: Ctx, plan: PlanKey) {
  assertDemoBilling();
  const org = await orgWithSub(ctx.orgId);
  const now = orgNow(org);
  const sub = org.subscription;
  assertNotShopManaged(sub);
  if (sub && sub.status === "active") return changePlan(ctx, plan);
  return prisma.$transaction(async (tx) => {
    const data = {
      plan,
      status: "active" as const,
      provider: "demo" as const,
      currentPeriodStart: now,
      currentPeriodEnd: addMonthsUtc(now, 1),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      pendingPlan: null,
      demoFailNextRenewal: false,
    };
    const saved = sub
      ? await tx.subscription.update({ where: { id: sub.id }, data })
      : await tx.subscription.create({ data: { organizationId: ctx.orgId, ...data } });
    await syncCounterLimits(tx, ctx.orgId, saved);
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "billing.demo_checkout", targetType: "subscription", targetId: saved.id, meta: { plan } });
    return saved;
  });
}

/** Upgrade sofort, Downgrade zum Periodenende (Demo-Regel). */
export async function changePlan(ctx: Ctx, plan: PlanKey) {
  assertDemoBilling();
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { organizationId: ctx.orgId } });
    assertNotShopManaged(sub);
    if (!sub || sub.status === "canceled") throw new AppError("NO_SUBSCRIPTION", "Kein aktives Abo.", 409);
    let saved: Subscription;
    if (plan === sub.plan) {
      saved = await tx.subscription.update({ where: { id: sub.id }, data: { pendingPlan: null } });
    } else if (PLAN_RANK[plan] > PLAN_RANK[sub.plan]) {
      saved = await tx.subscription.update({ where: { id: sub.id }, data: { plan, pendingPlan: null } });
      await syncCounterLimits(tx, ctx.orgId, saved);
    } else {
      saved = await tx.subscription.update({ where: { id: sub.id }, data: { pendingPlan: plan } });
    }
    await audit(tx, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "billing.change_plan", targetType: "subscription", targetId: sub.id, meta: { from: sub.plan, to: plan } });
    return saved;
  });
}

export async function cancelAtPeriodEnd(ctx: Ctx) {
  assertDemoBilling();
  const sub = await prisma.subscription.findUnique({ where: { organizationId: ctx.orgId } });
  assertNotShopManaged(sub);
  if (!sub || sub.status === "canceled") throw new AppError("NO_SUBSCRIPTION", "Kein aktives Abo.", 409);
  const saved = await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "billing.cancel", targetType: "subscription", targetId: sub.id });
  return saved;
}

export async function resumeSubscription(ctx: Ctx) {
  assertDemoBilling();
  const sub = await prisma.subscription.findUnique({ where: { organizationId: ctx.orgId } });
  assertNotShopManaged(sub);
  if (!sub || sub.status === "canceled") throw new AppError("NO_SUBSCRIPTION", "Ein beendetes Abo kann nur über einen neuen Plan gestartet werden.", 409);
  const saved = await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false } });
  await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "billing.resume", targetType: "subscription", targetId: sub.id });
  return saved;
}

/** Nur Demo: Szenarien für Verlängerung, Zahlungsausfall und Periodenwechsel. */
export async function demoBillingAction(ctx: Ctx, action: "fail_next_renewal" | "end_period_now" | "pay_now") {
  assertDemoBilling();
  if (!isDemoMode()) throw new AppError("NOT_DEMO", "Nur im Demo-Modus.", 400);
  const org = await orgWithSub(ctx.orgId);
  const sub = org.subscription;
  if (!sub) throw new AppError("NO_SUBSCRIPTION", "Kein Abo vorhanden.", 409);
  const now = orgNow(org);
  let saved: Subscription;
  if (action === "fail_next_renewal") {
    saved = await prisma.subscription.update({ where: { id: sub.id }, data: { demoFailNextRenewal: true } });
  } else if (action === "end_period_now") {
    saved = await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: now } });
    saved = await rollSubscription(prisma, saved, now);
  } else {
    if (sub.status !== "past_due") throw new AppError("NOT_PAST_DUE", "Es ist keine Zahlung offen.", 409);
    saved = await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "active", currentPeriodStart: now, currentPeriodEnd: addMonthsUtc(now, 1), demoFailNextRenewal: false },
      });
      await syncCounterLimits(tx, ctx.orgId, s);
      return s;
    });
  }
  await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: `billing.demo.${action}`, targetType: "subscription", targetId: sub.id });
  return saved;
}

/**
 * Periodenwechsel für Demo-Abos (vom Worker aufgerufen). Stripe-Abos werden nur über Webhooks geändert.
 * - Kündigung zum Periodenende → beendet
 * - simulierte Zahlungsstörung → Zahlung offen (Produktion und Veröffentlichung pausieren)
 * - sonst: neue Periode, ausstehende Herabstufung wird wirksam
 */
export async function rollSubscription(db: Db, sub: Subscription, now: Date): Promise<Subscription> {
  if (sub.provider !== "demo" || sub.status !== "active" || now.getTime() < sub.currentPeriodEnd.getTime()) return sub;
  if (sub.cancelAtPeriodEnd) {
    const s = await db.subscription.update({ where: { id: sub.id }, data: { status: "canceled", canceledAt: now } });
    await audit(db, { orgId: sub.organizationId, actor: { type: "worker" }, action: "billing.period_end.canceled", targetType: "subscription", targetId: sub.id });
    return s;
  }
  if (sub.demoFailNextRenewal) {
    const s = await db.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
    await audit(db, { orgId: sub.organizationId, actor: { type: "worker" }, action: "billing.renewal_failed", targetType: "subscription", targetId: sub.id });
    return s;
  }
  let start = sub.currentPeriodEnd;
  let end = addMonthsUtc(start, 1);
  let guard = 0;
  while (end.getTime() <= now.getTime() && guard++ < 24) {
    start = end;
    end = addMonthsUtc(start, 1);
  }
  const s = await db.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodStart: start, currentPeriodEnd: end, plan: sub.pendingPlan ?? sub.plan, pendingPlan: null },
  });
  await syncCounterLimits(db, sub.organizationId, s);
  await audit(db, { orgId: sub.organizationId, actor: { type: "worker" }, action: "billing.period_renewed", targetType: "subscription", targetId: sub.id, meta: { plan: s.plan } });
  return s;
}

export function planPriceLabel(plan: PlanKey) {
  return `${PLANS[plan].priceEurMonthly} € / Monat`;
}

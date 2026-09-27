import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { env } from "@/lib/env";
import { cancelAtPeriodEnd, changePlan, demoBillingAction, demoCheckout, resumeSubscription } from "@/lib/billing/service";
import { createCheckout, createPortal } from "@/providers/stripe";
import { notFound, AppError } from "@/lib/errors";

const planSchema = z.object({ plan: z.enum(["starter", "studio"]) });

export const POST = api<{ action: string }>(async ({ req, ctx, viewer, params }) => {
  const stripeMode = env().BILLING_PROVIDER === "stripe";
  switch (params.action) {
    case "checkout": {
      const { plan } = await parseBody(req, planSchema);
      if (stripeMode) return { redirect: await createCheckout(ctx.orgId, viewer.user.email, plan) };
      const s = await demoCheckout(ctx, plan);
      return { subscription: { plan: s.plan, status: s.status }, demo: true };
    }
    case "change-plan": {
      const { plan } = await parseBody(req, planSchema);
      if (stripeMode) return { redirect: await createPortal(ctx.orgId) };
      const s = await changePlan(ctx, plan);
      return { plan: s.plan, pendingPlan: s.pendingPlan };
    }
    case "cancel":
      if (stripeMode) return { redirect: await createPortal(ctx.orgId) };
      await cancelAtPeriodEnd(ctx);
      return { ok: true };
    case "resume":
      if (stripeMode) return { redirect: await createPortal(ctx.orgId) };
      await resumeSubscription(ctx);
      return { ok: true };
    case "portal":
      if (!stripeMode) throw new AppError("NOT_AVAILABLE", "Im Demo-Billing gibt es kein Kundenportal.", 400);
      return { redirect: await createPortal(ctx.orgId) };
    case "demo": {
      const { action } = await parseBody(req, z.object({ action: z.enum(["fail_next_renewal", "end_period_now", "pay_now"]) }));
      const s = await demoBillingAction(ctx, action);
      return { status: s.status, plan: s.plan };
    }
    default:
      throw notFound("Aktion");
  }
});

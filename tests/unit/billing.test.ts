import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { demoCheckout, changePlan, cancelAtPeriodEnd, resumeSubscription, demoBillingAction } from "@/lib/billing/service";
import { ensureCounter } from "@/lib/quota";
import { makeCustomer } from "./helpers";

describe("Demo-Billing", () => {
  it("Checkout, Upgrade sofort, Downgrade zum Periodenende, Kündigung und Wiederaufnahme", async () => {
    const { ctx, org } = await makeCustomer({ withSub: false });
    let s = await demoCheckout(ctx, "starter");
    expect(s.status).toBe("active");
    expect((await ensureCounter(prisma, org.id, s, "longform")).limit).toBe(15);
    s = await changePlan(ctx, "studio");
    expect(s.plan).toBe("studio");
    expect((await ensureCounter(prisma, org.id, s, "longform")).limit).toBe(30);
    s = await changePlan(ctx, "starter");
    expect(s.plan).toBe("studio");
    expect(s.pendingPlan).toBe("starter");
    s = await cancelAtPeriodEnd(ctx);
    expect(s.cancelAtPeriodEnd).toBe(true);
    s = await resumeSubscription(ctx);
    expect(s.cancelAtPeriodEnd).toBe(false);
    s = await demoBillingAction(ctx, "end_period_now");
    expect(s.plan).toBe("starter");
    expect(s.pendingPlan).toBeNull();
    expect(s.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it("fehlgeschlagene Verlängerung setzt „Zahlung offen“, Nachzahlung reaktiviert", async () => {
    const { ctx } = await makeCustomer({ withSub: false });
    await demoCheckout(ctx, "studio");
    await demoBillingAction(ctx, "fail_next_renewal");
    let s = await demoBillingAction(ctx, "end_period_now");
    expect(s.status).toBe("past_due");
    s = await demoBillingAction(ctx, "pay_now");
    expect(s.status).toBe("active");
  });

  it("Kündigung zum Periodenende beendet das Abo", async () => {
    const { ctx } = await makeCustomer({ withSub: false });
    await demoCheckout(ctx, "studio");
    await cancelAtPeriodEnd(ctx);
    const s = await demoBillingAction(ctx, "end_period_now");
    expect(s.status).toBe("canceled");
  });
});

import Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isUniqueViolation } from "@/lib/errors";
import { syncSubscriptionFromStripe } from "@/providers/stripe";

/** Stripe-Webhooks: Signaturprüfung, Idempotenz (event.id), Reihenfolgeschutz (event.created). */
export async function handleStripeWebhook(raw: string, signature: string | null) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) return { httpStatus: 503, body: { error: "Stripe-Webhook nicht konfiguriert" } };
  if (!signature) return { httpStatus: 400, body: { error: "Signatur fehlt" } };
  const verifier = new Stripe(env().STRIPE_SECRET_KEY ?? "sk_test_signature_only");
  let event: Stripe.Event;
  try {
    event = verifier.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return { httpStatus: 400, body: { error: "Signatur ungültig" } };
  }
  let rowId: string;
  try {
    const row = await prisma.webhookEvent.create({
      data: { provider: "stripe", eventId: event.id, eventType: event.type, payload: JSON.parse(raw) as Prisma.InputJsonValue },
    });
    rowId = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { httpStatus: 200, body: { duplicate: true } };
    throw e;
  }
  let status: "processed" | "ignored" = "ignored";
  let note: string | undefined;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const r = await syncSubscriptionFromStripe(event.data.object as never, event.created);
      status = "synced" in r ? "processed" : "ignored";
      note = "ignored" in r ? String(r.ignored) : undefined;
      break;
    }
    case "checkout.session.completed": {
      // Nur Verknüpfung – Zugang entsteht erst über das Abo-Ereignis.
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.client_reference_id ?? s.metadata?.orgId;
      const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
      if (orgId && customer) {
        await prisma.subscription.updateMany({ where: { organizationId: orgId }, data: { providerCustomerId: customer } });
        status = "processed";
      }
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed":
      note = "Informativ – Status folgt über customer.subscription.updated";
      break;
    default:
      note = "Nicht benötigtes Ereignis";
  }
  await prisma.webhookEvent.update({ where: { id: rowId }, data: { status, error: note, processedAt: new Date() } });
  return { httpStatus: 200, body: { status } };
}

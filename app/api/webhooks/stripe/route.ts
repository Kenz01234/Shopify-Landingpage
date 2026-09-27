import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/webhooks/stripe";

export async function POST(req: Request) {
  const raw = await req.text();
  const r = await handleStripeWebhook(raw, req.headers.get("stripe-signature"));
  return NextResponse.json(r.body, { status: r.httpStatus });
}

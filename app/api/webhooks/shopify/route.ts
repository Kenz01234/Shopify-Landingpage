import { NextResponse } from "next/server";
import { handleShopifyWebhook } from "@/lib/billing/shopify";

/** Shopify-Webhooks (orders/paid, orders/cancelled). Der Body wird unverändert für die HMAC-Prüfung gelesen. */
export async function POST(req: Request) {
  const raw = await req.text();
  const r = await handleShopifyWebhook(raw, req.headers);
  return NextResponse.json(r.body, { status: r.httpStatus });
}

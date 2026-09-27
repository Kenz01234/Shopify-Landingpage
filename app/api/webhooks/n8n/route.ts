import { NextResponse } from "next/server";
import { handleN8nCallback } from "@/lib/webhooks/n8n";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 2_000_000) return NextResponse.json({ error: "Zu groß" }, { status: 413 });
  const r = await handleN8nCallback(raw, req.headers);
  return NextResponse.json(r.body, { status: r.httpStatus });
}

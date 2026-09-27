import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { sameOrigin, errorResponse } from "@/lib/api";
import { DEMO_ACCOUNTS } from "@/lib/demo/seed";
import { AppError } from "@/lib/errors";

/** Demo-Einstieg: meldet ein lokales Demo-Konto an. Nur mit DEMO_MODE=true verfügbar. */
export async function POST(req: Request) {
  try {
    if (!isDemoMode()) throw new AppError("NOT_FOUND", "Nicht gefunden.", 404);
    if (!sameOrigin(req)) throw new AppError("CSRF", "Anfrage von fremder Herkunft abgelehnt.", 403);
    const { account } = z.object({ account: z.enum(["kunde", "zweiter", "admin"]) }).parse(await req.json());
    const res = await auth.api.signInEmail({
      body: { email: DEMO_ACCOUNTS[account].email, password: process.env.DEMO_PASSWORD ?? "" },
      headers: req.headers,
      asResponse: true,
    });
    if (!res.ok) throw new AppError("DEMO_LOGIN", "Demo-Konto nicht verfügbar. Bitte `npm run db:seed` ausführen.", 409);
    const out = NextResponse.json({ ok: true, redirect: account === "admin" ? "/admin" : "/app" });
    for (const c of res.headers.getSetCookie()) out.headers.append("set-cookie", c);
    return out;
  } catch (e) {
    return errorResponse(e);
  }
}

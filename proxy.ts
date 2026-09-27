import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistische Weiterleitung für geschützte Bereiche (nur Cookie-Existenz).
 * Die eigentliche Prüfung der Session und Rolle erfolgt serverseitig in Layouts und API-Routen.
 */
export function proxy(req: NextRequest) {
  const cookie = getSessionCookie(req, { cookiePrefix: "qa" });
  if (!cookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("weiter", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };

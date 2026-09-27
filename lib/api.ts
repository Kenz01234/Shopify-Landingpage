import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { getViewer, type Viewer } from "@/lib/session";
import type { Ctx } from "@/lib/jobs/service";

/**
 * Wrapper für API-Routen: Authentifizierung, Same-Origin-Prüfung für schreibende Anfragen (CSRF),
 * einheitliche Fehlerantworten mit deutschen Meldungen.
 */
type Handler<P> = (args: { req: Request; viewer: Viewer; ctx: Ctx; params: P }) => Promise<unknown>;

export function sameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return site === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, ...(e.details ?? {}) } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join(".")] = i.message;
    return NextResponse.json({ error: { code: "VALIDATION", message: "Bitte die Eingaben prüfen.", fields } }, { status: 422 });
  }
  console.error("[api]", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Unerwarteter Fehler. Bitte später erneut versuchen." } }, { status: 500 });
}

export function api<P = Record<string, string>>(handler: Handler<P>, opts: { admin?: boolean } = {}) {
  return async (req: Request, context: { params: Promise<P> }) => {
    try {
      if (!sameOrigin(req)) throw new AppError("CSRF", "Anfrage von fremder Herkunft abgelehnt.", 403);
      const viewer = await getViewer();
      if (!viewer) throw new AppError("UNAUTHENTICATED", "Bitte melde dich an.", 401);
      if (opts.admin && viewer.user.platformRole !== "admin") throw new AppError("NOT_FOUND", "Nicht gefunden.", 404);
      const params = (await context.params) ?? ({} as P);
      const ctx: Ctx = { orgId: viewer.org.id, userId: viewer.user.id, actor: { type: opts.admin ? "admin" : "user", userId: viewer.user.id } };
      const result = await handler({ req, viewer, ctx, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Ungültige Anfrage.", 400);
  }
  return schema.parse(json);
}

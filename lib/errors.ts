/** Fachlicher Fehler mit verständlicher deutscher Meldung. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Eintrag") => new AppError("NOT_FOUND", `${what} wurde nicht gefunden.`, 404);
export const forbidden = (msg = "Dafür fehlt dir die Berechtigung.") => new AppError("FORBIDDEN", msg, 403);
export const conflict = (msg: string, details?: Record<string, unknown>) => new AppError("CONFLICT", msg, 409, details);

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

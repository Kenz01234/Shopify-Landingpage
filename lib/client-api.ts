"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** fetch-Hülle für die eigenen API-Routen – liefert deutsche Fehlermeldungen des Servers weiter. */
export async function apiFetch<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Keine Verbindung zum Server. Bitte erneut versuchen.", 0);
  }
  const json = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string; fields?: Record<string, string> } } | null;
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? `Fehler ${res.status}`, res.status, json?.error?.code, json?.error?.fields);
  }
  return json as T;
}

export function newKey() {
  return crypto.randomUUID();
}

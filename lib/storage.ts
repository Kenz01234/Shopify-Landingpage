import path from "node:path";
import fs from "node:fs";

/**
 * Dateiablage. Speicherschlüssel sind relativ („fixtures/…“, „uploads/…“) und werden nur
 * serverseitig in Pfade übersetzt. Pfad-Traversal wird abgewiesen.
 */
const ROOT = path.resolve(process.cwd(), "storage");
const ALLOWED_PREFIXES = ["fixtures/", "uploads/"];

export function resolveStorageKey(key: string): string {
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) throw new Error("Ungültiger Speicherschlüssel");
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ungültiger Speicherschlüssel");
  return full;
}

export function storageFileInfo(key: string): { path: string; size: number } | null {
  try {
    const p = resolveStorageKey(key);
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return { path: p, size: st.size };
  } catch {
    return null;
  }
}

export function uploadsDir() {
  const dir = path.join(ROOT, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

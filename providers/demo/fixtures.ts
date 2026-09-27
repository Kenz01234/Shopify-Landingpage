import fs from "node:fs";
import path from "node:path";

export type FixtureEntry = {
  key: string;
  file: string;
  kind: "video" | "short" | "audio";
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  width?: number;
  height?: number;
  scene?: string;
  voice?: string;
  license: string;
  origin: string;
};

let cache: FixtureEntry[] | null = null;

/** Liest das Manifest der lokalen Demo-Medien (erzeugt von scripts/generate-demo-media.mjs). */
export function fixtures(): FixtureEntry[] {
  if (cache) return cache;
  const p = path.resolve(process.cwd(), "storage/fixtures/manifest.json");
  try {
    cache = JSON.parse(fs.readFileSync(p, "utf8")).files as FixtureEntry[];
  } catch {
    cache = [];
  }
  return cache;
}

export function findFixture(kind: FixtureEntry["kind"], match: { scene?: string; voice?: string }) {
  const list = fixtures().filter((f) => f.kind === kind);
  return (
    list.find((f) => (match.scene ? f.scene === match.scene : true) && (match.voice ? f.voice === match.voice : true)) ?? list[0] ?? null
  );
}

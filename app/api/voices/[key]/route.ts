import fs from "node:fs";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { findDemoVoice } from "@/lib/voices";
import { findFixture } from "@/providers/demo/fixtures";
import { storageFileInfo } from "@/lib/storage";

/** Hörprobe einer Demo-Stimme (lokale Datei). Fehlt sie, wird das ehrlich gemeldet. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: { message: "Bitte melde dich an." } }, { status: 401 });
  const { key } = await params;
  const voice = findDemoVoice(key);
  const fx = voice ? findFixture("audio", { voice: voice.key }) : null;
  const info = fx ? storageFileInfo(`fixtures/${fx.file}`) : null;
  if (!voice || !fx || fx.voice !== voice.key || !info) {
    return NextResponse.json({ error: { message: "Für diese Stimme ist keine Hörprobe vorhanden." } }, { status: 404 });
  }
  return new NextResponse(fs.readFileSync(info.path), {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600", "content-length": String(info.size) },
  });
}

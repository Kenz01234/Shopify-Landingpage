import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storageFileInfo } from "@/lib/storage";
import { verifyMediaToken } from "@/lib/media-links";

/**
 * Befristeter, signierter Abruf eines Videos durch eine Plattform (Instagram lädt Reels selbst herunter).
 * Ohne gültige, unabgelaufene Signatur gibt es nichts; nur Videos (keine Audio- oder sonstigen Dateien).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = verifyMediaToken(token);
  if (!ok) return NextResponse.json({ error: { message: "Link ungültig oder abgelaufen." } }, { status: 404 });
  const asset = await prisma.asset.findFirst({ where: { id: ok.assetId, kind: { in: ["video", "short"] } } });
  const info = asset ? storageFileInfo(asset.storageKey) : null;
  if (!asset || !info) return NextResponse.json({ error: { message: "Datei nicht gefunden." } }, { status: 404 });
  return new NextResponse(Readable.toWeb(fs.createReadStream(info.path)) as ReadableStream, {
    status: 200,
    headers: {
      "content-type": asset.mimeType,
      "content-length": String(info.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}

import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { storageFileInfo } from "@/lib/storage";

/**
 * Auslieferung eigener Medien – nur für die besitzende Organisation, ohne interne Pfade.
 * Unterstützt Range-Anfragen (Video-Scrubbing) und ?download=1.
 */
export async function GET(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: { message: "Bitte melde dich an." } }, { status: 401 });
  const { assetId } = await params;
  const asset = await prisma.asset.findFirst({ where: { id: assetId, organizationId: viewer.org.id } });
  if (!asset) return NextResponse.json({ error: { message: "Datei nicht gefunden." } }, { status: 404 });
  const info = storageFileInfo(asset.storageKey);
  if (!info) return NextResponse.json({ error: { message: "Datei fehlt im Speicher." } }, { status: 410 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "content-type": asset.mimeType,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${asset.fileName.replace(/[^\w.\-]/g, "_")}"`,
  });
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), info.size - 1) : Math.min(start + 1024 * 1024 - 1, info.size - 1);
    if (start >= info.size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    }
    headers.set("content-range", `bytes ${start}-${end}/${info.size}`);
    headers.set("content-length", String(end - start + 1));
    const stream = Readable.toWeb(fs.createReadStream(info.path, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }
  headers.set("content-length", String(info.size));
  return new NextResponse(Readable.toWeb(fs.createReadStream(info.path)) as ReadableStream, { status: 200, headers });
}

import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sceneForNiche } from "@/lib/demo/content";
import type { ConfigSnapshot, WorkingData } from "@/providers/types";

/** Thumbnail-Entwurf als SVG (1280×720) aus Motiv + Thumbnail-Text der Version. */
const SCENES = ["space", "history", "ocean", "nature", "tech"];
const cache = new Map<string, string>();
function sceneInner(scene: string) {
  const key = SCENES.includes(scene) ? scene : "space";
  if (!cache.has(key)) {
    const raw = fs.readFileSync(path.resolve(process.cwd(), "storage/fixtures/scenes", `${key}.svg`), "utf8");
    cache.set(key, raw.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""));
  }
  return cache.get(key)!;
}

function wrap(text: string, max = 16) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function GET(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: { message: "Bitte melde dich an." } }, { status: 401 });
  const { versionId } = await params;
  const v = await prisma.contentVersion.findFirst({ where: { id: versionId, organizationId: viewer.org.id }, include: { job: true } });
  if (!v) return NextResponse.json({ error: { message: "Nicht gefunden." } }, { status: 404 });
  const snap = v.job.configSnapshot as unknown as ConfigSnapshot;
  const wd = (v.job.workingData ?? {}) as WorkingData;
  const scene = wd.scene ?? sceneForNiche(snap.niche, snap.name);
  const lines = wrap((v.thumbnailText || v.title).toUpperCase());
  const text = lines
    .map(
      (l, i) =>
        `<text x="80" y="${400 - (lines.length - 1) * 55 + i * 110}" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="100" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="3" paint-order="stroke">${esc(l)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1280" height="720" preserveAspectRatio="xMidYMid slice">
<g>${sceneInner(scene)}</g>
<defs><linearGradient id="qa-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".65"/><stop offset=".7" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#qa-fade)"/>
${text}
<rect x="80" y="770" width="470" height="64" rx="14" fill="rgba(0,0,0,.45)"/>
<text x="104" y="813" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="30" fill="#fff">THUMBNAIL-ENTWURF · V${v.number}</text>
</svg>`;
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=60",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      ...(download ? { "content-disposition": `attachment; filename="thumbnail-v${v.number}.svg"` } : {}),
    },
  });
}

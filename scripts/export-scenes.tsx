/**
 * Exportiert die im Code gezeichneten Nischen-Motive als eigenständige SVG-Dateien
 * (für Thumbnail-Entwürfe, die Shopify-Section und statische Nutzung).
 *   npx tsx scripts/export-scenes.tsx
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NicheScene, NICHE_ORDER } from "../components/art/niche-scene";

const targets = [path.resolve("storage/fixtures/scenes"), path.resolve("public/scenes")];
for (const dir of targets) fs.mkdirSync(dir, { recursive: true });

for (const niche of NICHE_ORDER) {
  const markup = renderToStaticMarkup(<NicheScene niche={niche} />)
    .replace(/ class="[^"]*"/, "")
    .replace(/ style="[^"]*"/, "")
    .replace(/ aria-hidden="true"/, "")
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" ');
  for (const dir of targets) fs.writeFileSync(path.join(dir, `${niche}.svg`), markup);
  console.log("✓", niche, `${Math.round(markup.length / 1024)} KB`);
}

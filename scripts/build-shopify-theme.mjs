// Packt das eigene Theme (shopify/theme) in quest-agent-shopify-theme.zip – hochladbar über
// Onlineshop → Themes → „Theme hochladen“. Die Theme-Ordner liegen dabei direkt in der ZIP-Wurzel.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = "shopify/theme";
const DIRS = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"];
const out = path.resolve("quest-agent-shopify-theme.zip");

for (const d of ["layout/theme.liquid", "config/settings_schema.json", "config/settings_data.json", "locales/de.default.json", "templates/index.json"])
  if (!fs.existsSync(path.join(ROOT, d))) throw new Error(`Pflichtdatei fehlt: ${d}`);
const stray = fs.readdirSync(ROOT).filter((f) => !DIRS.includes(f));
if (stray.length) throw new Error(`Unerwartete Dateien im Theme-Ordner: ${stray.join(", ")}`);

fs.rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", "-q", out, ...DIRS, "-x", "*.DS_Store", "-x", "*/.*"], { cwd: ROOT, stdio: "inherit" });
const files = execFileSync("unzip", ["-Z1", out], { encoding: "utf8" }).trim().split("\n").filter((f) => !f.endsWith("/"));
console.log(`${path.basename(out)} erstellt – ${files.length} Dateien, ${Math.round(fs.statSync(out).size / 1024)} KB`);

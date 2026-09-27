// Baut ein vollständiges, über „Theme hochladen“ installierbares Theme: Shopify Horizon + Quest-Agent-Section.
//
//   node scripts/build-shopify-horizon-theme.mjs [pfad/zu/horizon]
//
// Ohne Pfad wird https://github.com/Shopify/horizon (Standard-Branch) in einen temporären Ordner geklont.
// Ergebnis: dist/horizon-quest-agent-theme.zip (liegt bewusst NICHT im Repository).
//
// Lizenz: Horizon © Shopify Inc. Die Horizon-Lizenz erlaubt ein abgeleitetes Theme nur zur direkten Übergabe an
// einen Händler für dessen eigenen Shop – nicht zur Veröffentlichung, zum Verkauf oder zur Weitergabe.
// Deshalb wird das zusammengeführte Theme nur lokal erzeugt und nicht committet.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const THEME_DIRS = ["assets", "blocks", "config", "layout", "locales", "sections", "snippets", "templates"];
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist", "horizon-quest-agent-theme");
const zip = path.join(root, "dist", "horizon-quest-agent-theme.zip");

let horizon = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!horizon) {
  horizon = fs.mkdtempSync(path.join(os.tmpdir(), "horizon-"));
  execFileSync("git", ["clone", "--quiet", "--depth", "1", "https://github.com/Shopify/horizon", horizon], { stdio: "inherit" });
}
const schema = JSON.parse(fs.readFileSync(path.join(horizon, "config", "settings_schema.json"), "utf8"));
const info = schema.find((s) => s.name === "theme_info");
if (info?.theme_name !== "Horizon") throw new Error(`${horizon} sieht nicht nach Shopify Horizon aus.`);

fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
for (const dir of THEME_DIRS) fs.cpSync(path.join(horizon, dir), path.join(out, dir), { recursive: true });

// Quest-Agent-Dateien ergänzen – Namenskollisionen wären ein Fehler, nichts von Horizon wird überschrieben
for (const dir of ["sections", "assets", "templates"]) {
  for (const file of fs.readdirSync(path.join(root, "shopify", dir))) {
    const target = path.join(out, dir, file);
    if (fs.existsSync(target)) throw new Error(`Kollision: ${dir}/${file} existiert bereits in Horizon.`);
    fs.copyFileSync(path.join(root, "shopify", dir, file), target);
  }
}

// Startseite dieses Themes = Quest-Agent-Landingpage (Horizons Header und Footer bleiben erhalten)
fs.copyFileSync(path.join(root, "shopify", "templates", "page.quest-agent.json"), path.join(out, "templates", "index.json"));

// Lizenzhinweis von Horizon muss beiliegen – als nie gerenderter Liquid-Kommentar innerhalb der Theme-Struktur
const license = fs.readFileSync(path.join(horizon, "LICENSE.md"), "utf8");
fs.writeFileSync(
  path.join(out, "snippets", "horizon-license.liquid"),
  `{% comment %}\nHorizon ${info.theme_version} – Lizenz (unverändert übernommen):\n\n${license.replaceAll("{%", "{ %")}\n{% endcomment %}\n`,
);

execFileSync("zip", ["-r", "-X", "-q", zip, ...THEME_DIRS], { cwd: out, stdio: "inherit" });
console.log(`${path.relative(root, zip)} erstellt: Horizon ${info.theme_version} + Quest Agent (${Math.round(fs.statSync(zip).size / 1024)} KB)`);

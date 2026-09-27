// Packt shopify/ in quest-agent-shopify-sections.zip (Section-Integrationspaket, kein vollständiges Theme).
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const out = "quest-agent-shopify-sections.zip";
fs.rmSync(out, { force: true });
// Das komplette Theme (shopify/theme) hat eine eigene ZIP: npm run shopify:theme
execFileSync("zip", ["-r", "-X", `../${out}`, ".", "-x", "theme/*"], { cwd: "shopify", stdio: "inherit" });
console.log(`${out} erstellt (${Math.round(fs.statSync(out).size / 1024)} KB)`);

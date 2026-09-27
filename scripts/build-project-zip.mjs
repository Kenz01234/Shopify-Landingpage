// Erstellt dist/quest-agent-projekt.zip aus den versionierten Dateien (git ls-files):
// keine node_modules, keine .env-Dateien, keine Build-Caches, keine Laufzeit-Uploads.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !/(^|\/)\.env($|\.)/.test(f) || f.endsWith(".env.example"))
  .filter((f) => !/^(node_modules|\.next|generated|dist|test-results|playwright-report|storage\/uploads|storage\/tmp)\//.test(f));
fs.mkdirSync("dist", { recursive: true });
const out = "dist/quest-agent-projekt.zip";
fs.rmSync(out, { force: true });
fs.writeFileSync("dist/.zip-list", files.join("\n"));
execFileSync("zip", ["-X", "-q", out, "-@"], { input: files.join("\n") });
fs.rmSync("dist/.zip-list");
console.log(`${out}: ${files.length} Dateien, ${Math.round(fs.statSync(out).size / 1024)} KB`);

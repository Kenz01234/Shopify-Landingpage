import fs from "node:fs";

export default function globalTeardown() {
  if (!fs.existsSync("test-results-worker.pid")) return;
  const pid = Number(fs.readFileSync("test-results-worker.pid", "utf8"));
  try {
    process.kill(-pid);
  } catch {
    try {
      process.kill(pid);
    } catch {
      /* bereits beendet */
    }
  }
  fs.rmSync("test-results-worker.pid");
}

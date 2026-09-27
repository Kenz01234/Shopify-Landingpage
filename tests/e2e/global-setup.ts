import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import { Client } from "pg";
import "dotenv/config";

/**
 * 1. Setzt ausschließlich die Demo-Konten zurück (isDemo = true) – echte Konten bleiben unberührt.
 * 2. Startet einen Worker, falls keiner aktiv ist (Herzschlag älter als 30 s).
 */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_RESEED !== "1") execSync("npx tsx prisma/seed.ts --reset", { stdio: "inherit" });
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`select "lastBeatAt" from "WorkerHeartbeat" where id='main'`);
  await c.end();
  const alive = r.rows[0] && Date.now() - new Date(r.rows[0].lastBeatAt).getTime() < 30_000;
  if (!alive) {
    const child = spawn("npx", ["tsx", "worker/index.ts"], { detached: true, stdio: "ignore" });
    child.unref();
    fs.writeFileSync("test-results-worker.pid", String(child.pid));
    await new Promise((res) => setTimeout(res, 4000));
  }
}

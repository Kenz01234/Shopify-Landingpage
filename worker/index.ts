import "dotenv/config";
import os from "node:os";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { claimNextJob, processJob } from "@/worker/pipeline";
import { schedulerTick } from "@/worker/scheduler";
import { claimDuePublication, publishOne, recoverStalePublishing, reconcileOne } from "@/worker/publisher";

/**
 * Quest-Agent-Worker: ein Prozess, persistente Jobtabelle, Leases statt Speicherzustand.
 * Beliebig oft neu startbar – laufende Aufträge werden nach Ablauf der Sperre fortgesetzt.
 */
const workerId = `${os.hostname()}-${process.pid}`;
let stopping = false;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...a);

async function heartbeat(info: Record<string, unknown>) {
  const now = new Date();
  await prisma.workerHeartbeat.upsert({
    where: { id: "main" },
    create: { id: "main", startedAt: now, lastBeatAt: now, info: { workerId, ...info } },
    update: { lastBeatAt: now, info: { workerId, ...info } },
  });
}

async function jobLoop() {
  while (!stopping) {
    let worked = false;
    try {
      const job = await claimNextJob(workerId);
      if (job) {
        worked = true;
        const r = await processJob(job, workerId);
        log(`Auftrag ${job.id.slice(-6)} ${job.status} → ${r}`);
      }
      const pub = await claimDuePublication();
      if (pub) {
        worked = true;
        const r = await publishOne(pub);
        log(`Veröffentlichung ${pub.id.slice(-6)} → ${r}`);
      }
    } catch (e) {
      log("Fehler im Job-Loop:", (e as Error).message);
    }
    if (!worked) await sleep(env().WORKER_TICK_MS);
  }
}

async function schedulerLoop() {
  while (!stopping) {
    try {
      const s = await schedulerTick();
      const stale = await recoverStalePublishing();
      const rec = await reconcileOne();
      await heartbeat({ ...s, stale, reconciled: rec, demo: env().DEMO_MODE });
      if (s.created || s.missed || s.renewed || stale) log("Scheduler:", JSON.stringify({ ...s, stale }));
    } catch (e) {
      log("Fehler im Scheduler:", (e as Error).message);
    }
    await sleep(env().SCHEDULER_TICK_MS);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  env();
  log(`gestartet (${workerId}), Demo-Modus: ${env().DEMO_MODE ? "an" : "aus"}, Provider: ${env().PRODUCTION_PROVIDER}/${env().VOICE_PROVIDER}/${env().PUBLISH_PROVIDER}`);
  // Sperren dieses Hosts aus einem früheren Lauf freigeben
  await prisma.productionJob.updateMany({ where: { lockedBy: { startsWith: `${os.hostname()}-` } }, data: { lockedBy: null, lockedUntil: null } });
  await heartbeat({ started: true });
  await Promise.all([jobLoop(), schedulerLoop()]);
  await prisma.$disconnect();
  log("beendet");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig} empfangen – beende nach aktuellem Schritt …`);
    stopping = true;
    setTimeout(() => process.exit(0), 15_000).unref();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

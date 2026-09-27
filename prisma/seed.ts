import "dotenv/config";
import { prisma } from "@/lib/db";
import { seedDemoData, resetDemoData, DEMO_ACCOUNTS } from "@/lib/demo/seed";

/**
 * Idempotentes Seeding. Legt Demo-Konten NUR bei DEMO_MODE=true an.
 *   npm run db:seed            – anlegen, falls noch nicht vorhanden
 *   npm run db:seed -- --reset – Demo-Daten löschen und neu anlegen
 */
async function main() {
  if (process.env.DEMO_MODE !== "true") {
    console.log("DEMO_MODE ist nicht aktiv – es werden keine Demo-Konten angelegt.");
    return;
  }
  const reset = process.argv.includes("--reset");
  const r = reset ? await resetDemoData() : await seedDemoData();
  if (r.skipped) console.log("Demo-Daten existieren bereits – nichts zu tun (--reset zum Neuaufbau).");
  else {
    console.log("Demo-Daten angelegt:");
    for (const a of Object.values(DEMO_ACCOUNTS)) console.log(`  ${a.email}  (Passwort: Wert aus DEMO_PASSWORD)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

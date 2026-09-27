import { execSync } from "node:child_process";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

/**
 * Jeder Testlauf erhält eine eigene, neu angelegte Datenbank (nur `prisma migrate deploy`).
 * Bestehende Datenbanken werden nie zurückgesetzt. Am Ende wird ausschließlich die in diesem
 * Lauf erzeugte Testdatenbank wieder entfernt.
 */
const ADMIN_URL = process.env.TEST_DB_ADMIN_URL ?? "postgresql://quest:quest@localhost:5432/postgres";

export default async function setup(project: TestProject) {
  const name = `quest_agent_test_run_${Date.now()}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString() } });
  project.provide("dbUrl", url.toString());

  return async () => {
    if (process.env.KEEP_TEST_DB === "1") return;
    const c = new Client({ connectionString: ADMIN_URL });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await c.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
  }
}

import { test, expect } from "@playwright/test";
import { demoLogin, sql } from "./helpers";

test("Zweiter Kunde sieht und ändert keine fremden Daten – auch nicht per manipulierter URL", async ({ page }) => {
  const [foreign] = await sql<{ job: string; asset: string; system: string; version: string }>(
    `select j.id as job, a.id as asset, j."systemId" as system, j."currentVersionId" as version from "ProductionJob" j
      join "Asset" a on a."jobId"=j.id join "Membership" m on m."organizationId"=j."organizationId" join "user" u on u.id=m."userId"
     where u.email='kunde@demo.questagent.local' limit 1`,
  );
  await demoLogin(page, "zweiter");
  for (const path of [`/app/freigaben/${foreign.job}`, `/app/produktion/${foreign.job}`, `/app/systeme/${foreign.system}`, "/admin"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  const api = page.request;
  expect((await api.get(`/api/jobs/${foreign.job}`)).status()).toBe(404);
  expect((await api.get(`/api/media/${foreign.asset}`)).status()).toBe(404);
  expect((await api.get(`/api/thumbnails/${foreign.version}`)).status()).toBe(404);
  const origin = { headers: { origin: "http://localhost:3000" } };
  expect((await api.post(`/api/jobs/${foreign.job}/cancel`, { ...origin, data: {} })).status()).toBe(404);
  expect((await api.post(`/api/systems/${foreign.system}/pause`, { ...origin, data: {} })).status()).toBe(404);
  expect((await api.post(`/api/admin/demo-reset`, { ...origin, data: { confirm: "ZURÜCKSETZEN" } })).status()).toBe(404);
  // Fremde Herkunft (CSRF) wird abgelehnt
  expect((await api.post(`/api/jobs/${foreign.job}/cancel`, { headers: { origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  const [still] = await sql<{ status: string }>(`select status from "ProductionJob" where id=$1`, [foreign.job]);
  expect(still.status).not.toBe("cancelled");
});

test("Ohne Anmeldung kein Zugriff auf Kundenbereich und APIs", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?weiter=%2Fapp/);
  expect((await page.request.get("/api/status")).status()).toBe(401);
});

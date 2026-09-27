import { test, expect } from "@playwright/test";
import { demoLogin, sql } from "./helpers";

test("Freigabe: Bearbeiten erzeugt neue Version, Freigabe plant ein, Demo-Veröffentlichung wird simuliert", async ({ page }) => {
  await demoLogin(page, "kunde");
  const [job] = await sql<{ id: string }>(
    `select j.id from "ProductionJob" j join "Organization" o on o.id=j."organizationId" join "Membership" m on m."organizationId"=o.id join "user" u on u.id=m."userId"
     where u.email='kunde@demo.questagent.local' and j.status='awaiting_approval' and j.format='longform' order by j."targetSlotAt" limit 1`,
  );
  const [ver] = await sql<{ number: number }>(`select v.number from "ContentVersion" v join "ProductionJob" j on j."currentVersionId"=v.id where j.id=$1`, [job.id]);
  const next = ver.number + 1;
  await page.goto(`/app/freigaben/${job.id}`);
  await expect(page.getByRole("heading", { name: "Prüfen & freigeben" })).toBeVisible();
  await expect(page.locator("video")).toBeVisible();

  // Inhaltsänderung → neue Version
  const title = page.getByLabel("Titel");
  await title.fill(`${await title.inputValue()} – überarbeitet`);
  await page.getByRole("button", { name: "Als neue Version speichern" }).click();
  await expect(page.getByText(`Version ${next} gespeichert`)).toBeVisible();
  await expect(page.getByText(`Version ${next}`, { exact: false }).first()).toBeVisible();

  // Freigabe mit Terminbestätigung
  await page.getByRole("button", { name: "Freigeben & einplanen" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText(`Freigabe gilt nur für Version ${next}.`)).toBeVisible();
  await dlg.getByRole("button", { name: "Ja, freigeben" }).click();
  await expect(page.getByText(/Eingeplant für/).first()).toBeVisible();
  const [pub] = await sql<{ status: string; mode: string }>(`select status, mode from "Publication" where "jobId"=$1`, [job.id]);
  expect(pub).toMatchObject({ status: "scheduled", mode: "simulated" });

  // Kalender + Demo-Zeitsteuerung → Worker veröffentlicht simuliert
  await page.goto("/app/kalender");
  await page.getByRole("button", { name: "Fällige Demo-Jobs ausführen" }).click();
  await expect
    .poll(async () => (await sql<{ status: string }>(`select status from "Publication" where "jobId"=$1`, [job.id]))[0].status, { timeout: 45_000, intervals: [1000] })
    .toBe("simulated");
  const [j] = await sql<{ status: string }>(`select status from "ProductionJob" where id=$1`, [job.id]);
  expect(j.status).toBe("published");
  await page.getByRole("button", { name: "Zurücksetzen" }).click();
});

test("Auftrag läuft über den Worker bis zur Freigabe (Status aus dem Backend)", async ({ page }) => {
  await demoLogin(page, "kunde");
  const [sys] = await sql<{ id: string }>(`select s.id from "ChannelSystem" s join "Membership" m on m."organizationId"=s."organizationId" join "user" u on u.id=m."userId" where u.email='kunde@demo.questagent.local' and s.name='Kosmos kompakt'`);
  await page.goto(`/app/systeme/${sys.id}`);
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Auftrag starten" }).click();
  await page.waitForURL(/\/app\/produktion\/[a-z0-9]+/);
  await expect(page.getByText("Live aus dem Backend")).toBeVisible();
  await expect(page.getByRole("link", { name: /Jetzt prüfen/ })).toBeVisible({ timeout: 60_000 });
  const id = page.url().split("/").pop()!;
  const [row] = await sql<{ status: string; quotaState: string }>(`select status, "quotaState" from "ProductionJob" where id=$1`, [id]);
  expect(row).toEqual({ status: "awaiting_approval", quotaState: "consumed" });
});

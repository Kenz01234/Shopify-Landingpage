import { test, expect } from "@playwright/test";
import { demoLogin, noHorizontalOverflow, sql } from "./helpers";

const WIDTHS = [360, 390, 768, 1440];
const PUBLIC = ["/", "/funktionen", "/preise", "/faq", "/kontakt", "/login", "/registrieren", "/demo", "/impressum"];

for (const w of WIDTHS) {
  test(`öffentliche Seiten ohne horizontalen Überlauf bei ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w < 800 ? 844 : 900 });
    for (const p of PUBLIC) {
      await page.goto(p);
      await page.waitForTimeout(300);
      await noHorizontalOverflow(page);
    }
    if (w < 768) {
      await page.goto("/");
      await page.getByRole("button", { name: "Menü öffnen" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile Navigation" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Mobile Navigation" }).getByRole("link", { name: "Preise" })).toBeVisible();
    }
  });

  test(`Kundenbereich ohne horizontalen Überlauf bei ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w < 800 ? 844 : 900 });
    await demoLogin(page, "kunde");
    const [job] = await sql<{ id: string }>(
      `select j.id from "ProductionJob" j join "Membership" m on m."organizationId"=j."organizationId" join "user" u on u.id=m."userId" where u.email='kunde@demo.questagent.local' and j.status='awaiting_approval' limit 1`,
    );
    for (const p of ["/app", "/app/systeme", "/app/systeme/neu", "/app/produktion", "/app/freigaben", `/app/freigaben/${job.id}`, "/app/kalender", "/app/medien", "/app/verbindungen", "/app/abo", "/app/konto"]) {
      await page.goto(p);
      await page.waitForTimeout(250);
      await noHorizontalOverflow(page);
    }
    if (w < 1024) {
      await page.getByRole("button", { name: "Menü öffnen" }).click();
      await expect(page.locator("#app-drawer")).toBeVisible();
      await page.locator("#app-drawer").getByRole("link", { name: "Kalender" }).click();
      await expect(page).toHaveURL(/\/app\/kalender/);
    }
  });
}

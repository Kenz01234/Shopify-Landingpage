import { test } from "@playwright/test";
import { demoLogin, sql } from "./helpers";

/** Erzeugt die Nachweis-Screenshots der tatsächlichen Umsetzung unter docs/screenshots/. */
const OUT = "docs/screenshots";

test("Screenshots: Startseite, Wizard, Freigabe, Kalender (Desktop und Mobil)", async ({ page }) => {
  for (const [w, h, tag] of [
    [1440, 900, "desktop"],
    [390, 844, "mobil"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${tag}-startseite.png` });
    await page.getByLabel("Interaktive Produktdemo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${OUT}/${tag}-startseite-loop-freigabe.png` });
    await page.goto("/#konfigurator");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${tag}-startseite-konfigurator.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("qa-theme", "dark"));
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/desktop-startseite-dunkel.png` });
  await page.evaluate(() => localStorage.setItem("qa-theme", "light"));
});

test("Screenshots: Kundenbereich", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("qa-theme", "light"));
  for (const [w, h, tag] of [
    [1440, 900, "desktop"],
    [390, 844, "mobil"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await demoLogin(page, "kunde");
    const [job] = await sql<{ id: string }>(
      `select j.id from "ProductionJob" j join "Membership" m on m."organizationId"=j."organizationId" join "user" u on u.id=m."userId" where u.email='kunde@demo.questagent.local' and j.status='awaiting_approval' and j.format='longform' limit 1`,
    );
    await page.goto("/app");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-uebersicht.png`, fullPage: tag === "desktop" });
    await page.goto("/app/systeme/neu");
    await page.getByLabel("Name des Systems").fill("Mein Wissenskanal");
    await page.getByRole("button", { name: "Weltall & Wissen" }).click();
    await page.getByLabel("Zielgruppe").fill("Neugierige Erwachsene");
    await page.screenshot({ path: `${OUT}/${tag}-wizard-schritt1.png`, fullPage: true });
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await page.getByLabel("Referenzkanal 1", { exact: true }).fill("@vorbild-eins");
    await page.getByLabel("Referenzkanal 2", { exact: true }).fill("youtube.com/watch?v=abc");
    await page.screenshot({ path: `${OUT}/${tag}-wizard-validierung.png`, fullPage: true });
    await page.getByLabel("Referenzkanal 2", { exact: true }).fill("@vorbild-zwei");
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await page.getByRole("group", { name: "Plattformen für Shorts" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-wizard-plattformen.png`, fullPage: true });
    await page.request.delete("/api/wizard-draft", { headers: { origin: "http://localhost:3000" } });
    await page.goto(`/app/freigaben/${job.id}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${tag}-freigabe.png`, fullPage: true });
    await page.goto("/app/kalender");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${tag}-kalender.png`, fullPage: true });
    await page.goto("/app/produktion");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${tag}-produktion.png`, fullPage: tag === "desktop" });
    await page.goto("/app/abo");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${tag}-abo.png`, fullPage: tag === "desktop" });
    await page.context().clearCookies();
  }
});

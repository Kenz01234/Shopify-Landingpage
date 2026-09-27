import { test, expect } from "@playwright/test";
import { noHorizontalOverflow } from "./helpers";

test("Hero-Loop: Demo läuft bis zur Freigabe und plant nach Bestätigung ein", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dein Faceless-Kanal.");
  await page.getByRole("button", { name: "Den Loop entdecken" }).click();
  const stage = page.getByLabel("Interaktive Produktdemo");
  await expect(stage.getByText("Wartet auf deine Freigabe")).toBeVisible({ timeout: 15_000 });
  await stage.getByRole("button", { name: "Freigeben" }).click();
  await expect(stage.getByText("Demo – es wird nichts veröffentlicht.")).toBeVisible();
});

test("Funnel: Konfigurator → Registrierung → Demo-Checkout → vorbefüllter Wizard → aktives System", async ({ page }) => {
  const email = `funnel-${Date.now()}@test.local`;
  await page.goto("/#konfigurator");
  const cfg = page.locator("#konfigurator");
  await cfg.getByText("Tiefsee & Meer", { exact: true }).click();
  await cfg.getByLabel("Referenzkanal 1", { exact: true }).fill("@tiefsee-vorbild");
  await expect(cfg.getByText("✓ Kanal erkannt")).toBeVisible();
  await cfg.getByLabel("Videos pro Woche").fill("2");
  await expect(cfg.getByText(/Starter\s*60\s*€/)).toBeVisible();
  await cfg.getByRole("button", { name: "Mit diesem Setup starten" }).click();
  await page.waitForURL(/\/registrieren\?plan=starter/);

  await page.getByLabel("Name").fill("Funnel Testperson");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill("Sicheres-Passwort-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Konto anlegen/ }).click();
  await page.waitForURL(/\/app\/abo\?plan=starter/);
  await expect(page.getByText("Schritt 2 von 3 · Plan bestätigen")).toBeVisible();
  await page.getByRole("button", { name: /Demo-Abo aktivieren/ }).click();
  await page.waitForURL(/\/app\/systeme\/neu/);
  await expect(page.getByText("Deine Auswahl von der Startseite wurde übernommen")).toBeVisible();

  // Schritt 1
  await expect(page.getByLabel("Nische")).toHaveValue("Tiefsee & Meer");
  await page.getByLabel("Name des Systems").fill("Tiefsee Test");
  await page.getByLabel("Zielgruppe").fill("Neugierige Erwachsene");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  // Schritt 2 – zweiter Referenzkanal
  await expect(page.getByLabel("Referenzkanal 1", { exact: true })).toHaveValue("@tiefsee-vorbild");
  await page.getByRole("button", { name: "Weiteren Kanal hinzufügen" }).click();
  await page.getByLabel("Referenzkanal 2", { exact: true }).fill("https://www.youtube.com/@zweites-vorbild");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  // Schritt 3 + 4
  await expect(page.getByRole("heading", { name: "Wie soll es klingen und aussehen?" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wie viel soll produziert werden?" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  // Schritt 5 – getrennte Slots vorhanden
  await expect(page.getByRole("group", { name: "Video-Slots (Longform)" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Shorts-Slots" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByText("Nächste gültige Slots")).toBeVisible();
  await page.getByRole("button", { name: "Speichern & Loop aktivieren" }).click();
  await page.waitForURL(/\/app\/systeme\/[a-z0-9]+\?neu=1/);
  await expect(page.getByText("Dein Loop ist aktiv")).toBeVisible();

  // Persistenz nach Reload
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tiefsee Test" })).toBeVisible();
  await expect(page.getByText("@tiefsee-vorbild")).toBeVisible();
  await expect(page.getByText("@zweites-vorbild")).toBeVisible();
  await noHorizontalOverflow(page);
});

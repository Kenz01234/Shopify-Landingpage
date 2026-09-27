import { test, expect } from "@playwright/test";

test("Tastatur: Skip-Link, Fokus und Bedienung des Hero-CTA", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  // Fokus erreicht den Primär-CTA
  for (let i = 0; i < 25; i++) {
    const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (name.startsWith("Eigenes System erstellen")) break;
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(":focus")).toContainText("Eigenes System erstellen");
});

test("Reduzierte Bewegung: Hero bleibt bedienbar (Pause, Schritt vor/zurück)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.getByLabel("Interaktive Produktdemo");
  await stage.scrollIntoViewIfNeeded();
  await stage.getByRole("button", { name: "Animation pausieren" }).click();
  await expect(stage.getByRole("button", { name: "Nächster Schritt" })).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const next = stage.getByRole("button", { name: "Nächster Schritt" });
    if (await next.isDisabled()) break;
    await next.click();
  }
  await expect(stage.getByText("Wartet auf deine Freigabe")).toBeVisible();
  await stage.getByRole("button", { name: "Freigeben" }).click();
  await expect(stage.getByText(/Eingeplant:/)).toBeVisible();
});

test("Dunkelmodus lässt sich umschalten und bleibt nach Reload erhalten", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Farbschema: Hell/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Formulare zeigen verständliche Fehler (Registrierung, Login)", async ({ page }) => {
  await page.goto("/registrieren");
  await page.getByRole("button", { name: /Konto anlegen/ }).click();
  await expect(page.getByText("Bitte deinen Namen angeben.")).toBeVisible();
  await expect(page.getByText("Mindestens 10 Zeichen.").first()).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill("niemand@test.local");
  await page.getByLabel("Passwort").fill("falsches-passwort");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("E-Mail-Adresse oder Passwort ist nicht korrekt.")).toBeVisible();
});

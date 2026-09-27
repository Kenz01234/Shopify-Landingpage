import { test, expect } from "@playwright/test";
import { sql } from "./helpers";

const EMAIL = "zweiter@demo.questagent.local";

test("Login mit Passwort, Pausieren und Kündigen über die Oberfläche bleiben nach Reload erhalten, Logout sperrt den Kundenbereich", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(EMAIL);
  await page.getByLabel("Passwort").fill(process.env.DEMO_PASSWORD ?? "");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL(/\/app$/);

  // System pausieren → Status kommt aus der Datenbank und übersteht den Reload
  const [system] = await sql<{ id: string }>(
    `select s.id from "ChannelSystem" s join "Membership" m on m."organizationId"=s."organizationId" join "user" u on u.id=m."userId"
      where u.email=$1 and s.status='active' limit 1`,
    [EMAIL],
  );
  await page.goto(`/app/systeme/${system.id}`);
  await page.getByRole("button", { name: "Pausieren" }).click();
  await expect(page.getByRole("button", { name: "Fortsetzen" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Fortsetzen" })).toBeVisible();
  expect((await sql<{ status: string }>(`select status from "ChannelSystem" where id=$1`, [system.id]))[0].status).toBe("paused");
  await page.getByRole("button", { name: "Fortsetzen" }).click();
  await expect(page.getByRole("button", { name: "Pausieren" })).toBeVisible();
  expect((await sql<{ status: string }>(`select status from "ChannelSystem" where id=$1`, [system.id]))[0].status).toBe("active");

  // Kündigung zum Periodenende → persistent → zurücknehmen
  await page.goto("/app/abo");
  await page.getByRole("button", { name: "Zum Periodenende kündigen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kündigen" }).click();
  await expect(page.getByRole("button", { name: "Kündigung zurücknehmen" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Kündigung zurücknehmen" })).toBeVisible();
  await page.getByRole("button", { name: "Kündigung zurücknehmen" }).click();
  await expect(page.getByRole("button", { name: "Zum Periodenende kündigen" })).toBeVisible();

  // Logout
  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

import { expect, type Page } from "@playwright/test";
import { Client } from "pg";
import "dotenv/config";

export async function demoLogin(page: Page, account: "kunde" | "zweiter" | "admin" = "kunde") {
  await page.goto("/demo");
  const name = account === "kunde" ? /Demo-Kundin/ : account === "admin" ? /Admin-Ansicht/ : /zweiter Demo-Kunde/;
  await page.getByRole("button", { name }).click();
  await page.waitForURL(account === "admin" ? /\/admin/ : /\/app/);
}

export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(query, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontaler Überlauf in px").toBeLessThanOrEqual(1);
}

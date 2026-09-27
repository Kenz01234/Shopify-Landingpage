#!/usr/bin/env node
/**
 * Prüft das eigene Shopify-Theme „Quest Agent“ (shopify/theme), bevor es in einen Shop geladen wird.
 *
 *   npm run shopify:theme:check                     Prüfungen
 *   npm run shopify:theme:check -- --screenshots DIR zusätzlich Screenshots (hell/dunkel × Desktop/Mobil)
 *
 * 1. Shopify Theme Check (offizielles Werkzeug) – 0 Befunde
 * 2. Upload-Regeln: Schemas, Templates, Section-Gruppen, globale Einstellungen (Typen, Standardwerte, Blöcke)
 * 3. Keine Geheimnisse im Theme
 * 4. Alle Seiten rendern (lokale Vorschau mit Beispieldaten, scripts/shopify-theme-preview.mjs)
 * 5. Browser: keine JS-Fehler, Warenkorb/Produkt/Abo/Kasse, Hell/Dunkel, Menü, ohne JavaScript, reduzierte Bewegung
 * 6. Theme-Editor: Sections entladen/neu laden, Block auswählen – nichts doppelt, keine Fehler
 * 7. Bildrate beim Scrollen der Startseite (Richtwert, headless)
 *
 * Grenzen: Die Vorschau bildet Shopify nach (LiquidJS, Attrappen für Preise/Abos/Checkout). Der echte Test im
 * Shop (Theme-Vorschau, Editor, Kauf mit Testzahlung) bleibt nötig – siehe shopify/INSTALLATION.md.
 */
import fs from "node:fs";
import path from "node:path";
import { themeCheckRun } from "@shopify/theme-check-node";
import { chromium } from "@playwright/test";
import { startPreview, THEME_DIR } from "./shopify-theme-preview.mjs";

const args = process.argv.slice(2);
const shotDir = args.includes("--screenshots") ? path.resolve(args[args.indexOf("--screenshots") + 1] ?? "shopify-theme-screenshots") : null;
const results = [];
const check = (name, pass, info = "") => {
  results.push({ name, pass });
  console.log(`${pass === null ? "–" : pass ? "✅" : "❌"} ${name}${info ? ` – ${info}` : ""}`);
};
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(THEME_DIR, ...p), "utf8"));

/* 1) Theme Check */
{
  const r = await themeCheckRun(THEME_DIR, undefined, () => {});
  const offenses = r.offenses ?? r;
  for (const o of offenses) console.log(`   [${o.severity}] ${o.check} ${path.relative(THEME_DIR, o.uri.replace(/^file:\/\//, ""))}: ${o.message}`);
  check("Shopify Theme Check", offenses.length === 0, `${offenses.length} Befunde`);
}

/* 2) Upload-Regeln */
{
  const problems = [];
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const RICH = /^\s*(<(p|ul|ol|h[1-6])[\s>][\s\S]*<\/(p|ul|ol|h[1-6])>\s*)+$/;
  function validate(def, val, where) {
    if (val === undefined || val === null) return;
    const t = def.type;
    if (["text", "textarea", "html", "liquid", "inline_richtext"].includes(t) && typeof val !== "string") problems.push(`${where}: Text erwartet`);
    if (t === "richtext" && val && !RICH.test(val)) problems.push(`${where}: richtext braucht <p>/<ul>/<ol>/<h*>`);
    if (t === "inline_richtext" && /<(p|ul|ol|div|h[1-6])[\s>]/.test(val)) problems.push(`${where}: inline_richtext ohne Block-Tags`);
    if (t === "url" && val && !/^(https?:\/\/|\/|shopify:\/\/|mailto:|tel:)/.test(val)) problems.push(`${where}: „${val}“ ist keine gültige URL (Sprungmarken als text-Einstellung)`);
    if ((t === "select" || t === "radio") && !def.options.some((o) => o.value === val)) problems.push(`${where}: ${val} ist keine Option`);
    if (t === "range") {
      const step = def.step ?? 1;
      const k = (val - def.min) / step;
      if (val < def.min || val > def.max || Math.abs(k - Math.round(k)) > 1e-9) problems.push(`${where}: ${val} passt nicht zu ${def.min}–${def.max}/${step}`);
    }
    if (t === "checkbox" && typeof val !== "boolean") problems.push(`${where}: true/false erwartet`);
    if (t === "color" && val && !HEX.test(val)) problems.push(`${where}: Hex-Farbe erwartet`);
    if (["image_picker", "product", "collection", "page", "blog", "article"].includes(t) && def.default !== undefined && where.endsWith("(Standard)"))
      problems.push(`${where}: ${t} darf keinen Standardwert haben`);
    if (t === "link_list" && where.endsWith("(Standard)") && !["main-menu", "footer"].includes(val)) problems.push(`${where}: nur main-menu/footer als Standard`);
  }
  function defsOf(settings, where) {
    const withId = (settings ?? []).filter((s) => s.id);
    const ids = withId.map((s) => s.id);
    if (new Set(ids).size !== ids.length) problems.push(`${where}: doppelte IDs`);
    for (const s of withId) {
      if (s.type === "range" && (s.max - s.min) / (s.step ?? 1) > 101) problems.push(`${where}.${s.id}: mehr als 101 Schritte`);
      if (!s.label) problems.push(`${where}.${s.id}: Beschriftung fehlt`);
      validate(s, s.default, `${where}.${s.id} (Standard)`);
    }
    return Object.fromEntries(withId.map((s) => [s.id, s]));
  }
  const sections = {};
  for (const f of fs.readdirSync(path.join(THEME_DIR, "sections")).filter((f) => f.endsWith(".liquid"))) {
    const src = fs.readFileSync(path.join(THEME_DIR, "sections", f), "utf8");
    const m = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(src);
    if (!m) {
      problems.push(`${f}: kein Schema`);
      continue;
    }
    let schema;
    try {
      schema = JSON.parse(m[1]);
    } catch (e) {
      problems.push(`${f}: Schema ist kein gültiges JSON (${e.message})`);
      continue;
    }
    const type = f.replace(/\.liquid$/, "");
    const defs = defsOf(schema.settings, type);
    const blocks = Object.fromEntries((schema.blocks ?? []).map((b) => [b.type, { ...b, defs: defsOf(b.settings, `${type}/${b.type}`) }]));
    for (const p of schema.presets ?? [])
      for (const b of p.blocks ?? []) {
        if (!blocks[b.type]) problems.push(`${type} Preset: unbekannter Blocktyp ${b.type}`);
        else for (const [k, v] of Object.entries(b.settings ?? {})) blocks[b.type].defs[k] ? validate(blocks[b.type].defs[k], v, `${type} Preset ${b.type}.${k}`) : problems.push(`${type} Preset: unbekannte Einstellung ${k}`);
      }
    sections[type] = { schema, defs, blocks };
  }
  function validateSectionData(where, sd) {
    const sec = sections[sd.type];
    if (!sec) return problems.push(`${where}: Section-Typ ${sd.type} fehlt`);
    for (const [k, v] of Object.entries(sd.settings ?? {})) sec.defs[k] ? validate(sec.defs[k], v, `${where}.${k}`) : problems.push(`${where}: unbekannte Einstellung ${k}`);
    const blocks = sd.blocks ?? {};
    const order = sd.block_order ?? [];
    if (JSON.stringify([...order].sort()) !== JSON.stringify(Object.keys(blocks).sort())) problems.push(`${where}: block_order passt nicht zu blocks`);
    if (order.length > (sec.schema.max_blocks ?? 50)) problems.push(`${where}: mehr Blöcke als max_blocks`);
    for (const [id, b] of Object.entries(blocks)) {
      const bd = sec.blocks[b.type];
      if (!bd) {
        problems.push(`${where}/${id}: unbekannter Blocktyp ${b.type}`);
        continue;
      }
      for (const [k, v] of Object.entries(b.settings ?? {})) bd.defs[k] ? validate(bd.defs[k], v, `${where}/${id}.${k}`) : problems.push(`${where}/${id}: unbekannte Einstellung ${k}`);
    }
  }
  const templates = [];
  const walk = (dir) =>
    fs.readdirSync(path.join(THEME_DIR, dir), { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : templates.push(path.join(dir, e.name))));
  walk("templates");
  for (const t of templates.filter((t) => t.endsWith(".json"))) {
    const tj = readJson(t);
    if (JSON.stringify([...tj.order].sort()) !== JSON.stringify(Object.keys(tj.sections).sort())) problems.push(`${t}: order passt nicht zu sections`);
    if (tj.layout && !fs.existsSync(path.join(THEME_DIR, "layout", `${tj.layout}.liquid`))) problems.push(`${t}: Layout ${tj.layout} fehlt`);
    for (const [k, sd] of Object.entries(tj.sections)) {
      validateSectionData(`${t}:${k}`, sd);
      const en = sections[sd.type]?.schema.enabled_on;
      if (en?.groups && !en.templates) problems.push(`${t}:${k}: ${sd.type} ist nur für Gruppen freigegeben`);
    }
  }
  for (const g of fs.readdirSync(path.join(THEME_DIR, "sections")).filter((f) => f.endsWith(".json"))) {
    const gj = readJson("sections", g);
    for (const [k, sd] of Object.entries(gj.sections)) validateSectionData(`sections/${g}:${k}`, sd);
  }
  const globalDefs = defsOf(
    readJson("config", "settings_schema.json").flatMap((grp) => grp.settings ?? []),
    "settings_schema",
  );
  for (const [k, v] of Object.entries(readJson("config", "settings_data.json").current ?? {}))
    if (typeof v !== "object") globalDefs[k] ? validate(globalDefs[k], v, `settings_data.${k}`) : problems.push(`settings_data: unbekannte Einstellung ${k}`);
  // Jede Section außer Haupt-/Gruppen-Sections braucht ein Preset, damit sie im Editor hinzufügbar ist
  for (const [type, s] of Object.entries(sections))
    if (type.startsWith("qa-") && !s.schema.presets?.length) problems.push(`${type}: kein Preset – im Editor nicht hinzufügbar`);
  problems.forEach((p) => console.log(`   ${p}`));
  check("Upload-Regeln (Schemas, Templates, Gruppen, Einstellungen)", problems.length === 0, `${Object.keys(sections).length} Sections, ${templates.length} Templates`);
}

/* 3) Keine Geheimnisse */
{
  const hits = [];
  const SECRET = /(shpat_|shpss_|shpca_|sk_live_|sk_test_|whsec_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-|ghp_[A-Za-z0-9]{20})/;
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (/\.(woff2|png|jpg)$/.test(e.name)) return;
      if (SECRET.test(fs.readFileSync(p, "utf8"))) hits.push(path.relative(THEME_DIR, p));
    });
  walk(THEME_DIR);
  check("Keine Zugangsdaten im Theme", hits.length === 0, hits.join(", "));
}

/* 4) Rendern */
const preview = await startPreview({ port: 0 });
const B = preview.url;
const ROUTES = [
  ["/", 200],
  ["/products/quest-agent-starter", 200],
  ["/products/extra-shorts", 200],
  ["/collections/all", 200],
  ["/collections", 200],
  ["/cart", 200],
  ["/search?q=shorts", 200],
  ["/search", 200],
  ["/pages/dashboard", 200],
  ["/pages/kontakt", 200],
  ["/pages/impressum", 200],
  ["/blogs/news", 200],
  ["/blogs/news/drei-plattformen", 200],
  ["/account/login", 200],
  ["/account/register", 200],
  ["/account", 200],
  ["/account/addresses", 200],
  ["/account/orders/1001", 200],
  ["/account/reset", 200],
  ["/account/activate", 200],
  ["/password", 200],
  ["/gift_cards/preview", 200],
  ["/gibt-es-nicht", 404],
];
{
  const bad = [];
  for (const [route, status] of ROUTES) {
    const r = await fetch(B + route);
    const html = await r.text();
    if (r.status !== status) bad.push(`${route}: ${r.status}`);
    if (/Übersetzung fehlt|Liquid error|\[object Object\]|undefined|NaN/.test(html)) bad.push(`${route}: verdächtige Ausgabe`);
  }
  // Ohne verknüpfte Plan-Produkte (Zustand direkt nach der Installation)
  const bare = await startPreview({ port: 0, linkPlans: false });
  const bareHtml = await (await fetch(bare.url + "/")).text();
  if (!/Kauf noch nicht eingerichtet/.test(bareHtml)) bad.push("/ ohne Produkte: Hinweis „Kauf noch nicht eingerichtet“ fehlt");
  await bare.close();
  bad.forEach((b) => console.log(`   ${b}`));
  check("Alle Seiten rendern", bad.length === 0, `${ROUTES.length} Seiten`);
}

/* 5–7) Browser */
const browser = await chromium.launch();
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return { ctx, page };
}
{
  const { ctx, page } = await newPage();
  const errs = [];
  for (const [route] of ROUTES.filter(([, s]) => s === 200)) {
    page.errors.length = 0;
    await page.goto(B + route, { waitUntil: "load" });
    await page.waitForTimeout(250);
    if (page.errors.length) errs.push(`${route}: ${page.errors.join("; ")}`);
  }
  errs.forEach((e) => console.log(`   ${e}`));
  check("Keine JavaScript-Fehler auf allen Seiten", errs.length === 0);
  await ctx.close();
}
{
  const { ctx, page: p } = await newPage();
  const fails = [];
  const expect = (name, cond) => cond || fails.push(name);
  await fetch(B + "/__reset");
  await p.goto(B + "/");
  await p.locator("#preise").scrollIntoViewIfNeeded();
  await p.locator("[data-quick-add] button").first().click();
  await p.waitForSelector("[data-cart-drawer].is-open", { timeout: 5000 }).catch(() => {});
  const line = await p.locator("[data-cart-drawer] .qa-line").first().innerText().catch(() => "");
  expect("Schnellkauf legt Plan mit Abo in den Warenkorb", /Starter/.test(line) && /Monatlich/.test(line));
  expect("Zähler im Header", (await p.locator("[data-cart-count]").first().innerText()).trim() === "1");
  await p.locator("[data-cart-drawer] [data-qty-step='1']").first().click();
  await p.waitForFunction(() => /120,00/.test(document.querySelector("[data-cart-subtotal]")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  expect("Menge + aktualisiert Zwischensumme", /120,00/.test(await p.locator("[data-cart-subtotal]").innerText().catch(() => "")));
  await p.locator("[data-cart-drawer] [data-remove]").first().click();
  await p.waitForSelector("[data-cart-drawer] .qa-cart-empty", { timeout: 5000 }).catch(() => {});
  expect("Entfernen leert den Warenkorb", (await p.locator("[data-cart-drawer] .qa-cart-empty").count()) === 1);
  await p.keyboard.press("Escape");
  await p.goto(B + "/products/extra-shorts");
  await p.locator("label.qa-swatch", { hasText: "20 Shorts" }).click();
  expect("Variante ändert Preis und Streichpreis", /28,00/.test(await p.locator("[data-price-now]").innerText()) && /30,00/.test(await p.locator("[data-price-was]").innerText()));
  await p.locator("label.qa-swatch", { hasText: "50 Shorts" }).click();
  expect("Ausverkaufte Variante sperrt den Kauf", (await p.locator("[data-add]").isDisabled()) && /Ausverkauft/.test(await p.locator("[data-add-label]").innerText()));
  await p.locator("label.qa-swatch", { hasText: "10 Shorts" }).click();
  expect("Verfügbare Variante gibt den Kauf frei", !(await p.locator("[data-add]").isDisabled()));
  await p.locator("[data-add]").click();
  await p.waitForSelector("[data-cart-drawer].is-open", { timeout: 5000 }).catch(() => {});
  expect("Produktformular öffnet das Warenkorb-Panel", (await p.locator("[data-cart-drawer].is-open").count()) === 1);
  await p.goto(B + "/products/quest-agent-starter");
  await Promise.all([p.waitForURL(/\/checkout$/, { timeout: 8000 }).catch(() => {}), p.locator("[data-direct-checkout]").click()]);
  expect("„Direkt zur Kasse“ führt mit Abo zur Kasse", p.url().endsWith("/checkout") && /Monatlich/.test(await p.locator("body").innerText()));
  await p.goto(B + "/cart");
  const input = p.locator("[data-qa-cart-page] [data-qty-input]").first();
  await input.fill("3");
  await input.dispatchEvent("change");
  await p.waitForFunction(() => document.querySelector("[data-cart-count]")?.textContent.trim() === "4", null, { timeout: 5000 }).catch(() => {});
  expect("Warenkorbseite: Mengenfeld aktualisiert per Section Rendering", (await p.locator("[data-cart-count]").first().innerText()).trim() === "4");
  fails.forEach((f) => console.log(`   ✗ ${f}`));
  check("Warenkorb, Varianten, Abo, Kasse (AJAX-API + Section Rendering)", fails.length === 0 && p.errors.length === 0, p.errors.join("; "));

  const fails2 = [];
  await p.goto(B + "/");
  const shown = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.locator("[data-theme-toggle]").first().click();
  await p.waitForTimeout(800);
  const now = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.reload();
  const kept = await p.evaluate(() => document.documentElement.dataset.theme);
  if (shown === now) fails2.push("Umschalter ändert die Darstellung nicht");
  if (kept !== now) fails2.push("Wahl bleibt nach dem Neuladen nicht erhalten");
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator("[data-menu-open]").first().click();
  await p.waitForTimeout(700);
  const menuTop = await p.evaluate(() => {
    const btn = document.querySelector("[data-menu-close]");
    const r = btn.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("[data-menu-close]") !== null;
  });
  if (!menuTop) fails2.push("Mobil-Menü: Schließen-Knopf ist verdeckt");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  if (await p.locator("[data-mnav].is-open").count()) fails2.push("Escape schließt das Menü nicht");
  fails2.forEach((f) => console.log(`   ✗ ${f}`));
  check("Hell/Dunkel-Umschalter und Mobil-Menü", fails2.length === 0, `${shown} → ${now}`);
  await ctx.close();
}
{
  // Handy: keine Seite darf seitlich scrollen (sonst wird z. B. das Warenkorb-Panel abgeschnitten)
  const { ctx, page } = await newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await fetch(B + "/__reset");
  await page.goto(B + "/products/quest-agent-starter");
  await page.locator("[data-add]").click();
  await page.waitForSelector("[data-cart-drawer].is-open", { timeout: 5000 }).catch(() => {});
  const wide = [];
  for (const [route] of ROUTES.filter(([, st]) => st === 200)) {
    await page.goto(B + route);
    await page.waitForTimeout(200);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (w[0] > w[1]) wide.push(`${route}: ${w[0]} px statt ${w[1]} px`);
    // Texte brauchen Abstand zum Bildschirmrand (laufende Bänder und Wischleisten ausgenommen).
    // Vorher einmal durchscrollen, damit Einblend-Effekte abgeschlossen sind.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let yy = 0; yy < h; yy += 500) {
      await page.evaluate((v) => window.scrollTo(0, v), yy);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(900);
    const edge = await page.evaluate(() =>
      [...document.querySelectorAll("#MainContent :is(h1, h2, h3, p, li, label, .qa-btn)")]
        .filter((el) => !el.closest(".qa-marquee, .qa-platforms__phones, [data-cart-drawer], [aria-hidden='true']"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.left < 10 || r.right > document.documentElement.clientWidth - 10);
        })
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()} „${el.textContent.trim().slice(0, 30)}“`),
    );
    if (edge.length) wide.push(`${route}: ohne Randabstand: ${edge.join(", ")}`);
  }
  await fetch(B + "/__reset");
  wide.forEach((w) => console.log(`   ${w}`));
  check("Handy (360 px): kein seitliches Scrollen, Texte mit Randabstand", wide.length === 0);
  await ctx.close();
}
{
  // Ohne JavaScript und mit reduzierter Bewegung muss alles lesbar sein
  const hidden = async (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-reveal], [data-split], .qa-hero h1")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && parseFloat(getComputedStyle(el).opacity) < 0.99;
      }).length,
    );
  const { ctx, page } = await newPage({ javaScriptEnabled: false });
  await page.goto(B + "/");
  const noJs = await hidden(page);
  await ctx.close();
  const r2 = await newPage({ reducedMotion: "reduce" });
  await r2.page.goto(B + "/");
  await r2.page.waitForTimeout(400);
  const rm = await hidden(r2.page);
  await r2.ctx.close();
  check("Ohne JavaScript / reduzierte Bewegung: nichts bleibt unsichtbar", noJs === 0 && rm === 0, `${noJs} bzw. ${rm} verborgene Elemente`);
}
{
  // Theme-Editor: Section neu laden (wie nach einer Änderung im Editor) – ohne Fehler, ohne doppelte Listener
  const { ctx, page } = await newPage();
  await page.goto(B + "/");
  await page.waitForTimeout(500);
  const res = await page.evaluate(async () => {
    const wrappers = [...document.querySelectorAll("#MainContent > .shopify-section")];
    for (const w of wrappers) {
      w.dispatchEvent(new CustomEvent("shopify:section:unload", { bubbles: true, detail: { sectionId: w.id } }));
      const html = w.innerHTML;
      w.innerHTML = html.replace(/ data-split-done="1"/g, "").replace(/ is-visible| is-in| is-live/g, "");
      w.dispatchEvent(new CustomEvent("shopify:section:load", { bubbles: true, detail: { sectionId: w.id } }));
    }
    // Der Editor kann Skripte erneut ausführen – das Theme-Skript darf sich dabei nicht doppelt registrieren
    await new Promise((resolve) => {
      const again = document.createElement("script");
      again.src = document.querySelector("script[src*='qa-theme.js']").src + "?again";
      again.onload = resolve;
      again.onerror = resolve;
      document.body.appendChild(again);
    });
    // Header-Button nach dem Neuladen: ein Klick muss genau einmal umschalten
    const before = document.documentElement.dataset.theme;
    document.querySelector("[data-theme-toggle]").click();
    await new Promise((r) => setTimeout(r, 900));
    const after = document.documentElement.dataset.theme;
    // Dashboard-Tabs funktionieren nach dem Neuladen
    const tab = document.querySelector("[data-dash-tab='calendar']");
    tab?.click();
    const calOn = document.querySelector("[data-dash-view='calendar']")?.classList.contains("is-on");
    // Block auswählen (FAQ-Frage wird geöffnet)
    const q = document.querySelector("#faq details");
    q?.dispatchEvent(new CustomEvent("shopify:block:select", { bubbles: true }));
    return { sections: wrappers.length, toggledOnce: before !== after, calOn, faqOpen: q?.open };
  });
  await page.waitForTimeout(300);
  const ok = res.toggledOnce && res.calOn && res.faqOpen && page.errors.length === 0;
  check("Theme-Editor: Sections neu laden, Block auswählen", ok, `${res.sections} Sections neu geladen${page.errors.length ? `, Fehler: ${page.errors.join("; ")}` : ""}`);
  await ctx.close();
}
{
  // Bildrate: Startseite in 4 s durchscrollen und Frame-Abstände messen (headless ohne GPU → nur Richtwert)
  const { ctx, page } = await newPage();
  await page.goto(B + "/");
  await page.waitForTimeout(800);
  const stats = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const total = document.documentElement.scrollHeight - innerHeight;
        const t0 = performance.now();
        let last = t0;
        const gaps = [];
        const step = (t) => {
          gaps.push(t - last);
          last = t;
          const k = Math.min(1, (t - t0) / 4000);
          window.scrollTo(0, total * k);
          if (k < 1) requestAnimationFrame(step);
          else {
            gaps.sort((a, b) => a - b);
            resolve({ frames: gaps.length, p95: gaps[Math.floor(gaps.length * 0.95)], long: gaps.filter((g) => g > 50).length });
          }
        };
        requestAnimationFrame(step);
      }),
  );
  check("Scroll-Bildrate (Richtwert)", stats.long <= 5, `${stats.frames} Frames, p95 ${stats.p95.toFixed(1)} ms, ${stats.long} Frames > 50 ms`);
  await ctx.close();
}

/* Screenshots */
if (shotDir) {
  fs.mkdirSync(shotDir, { recursive: true });
  const modes = [
    ["hell", "desktop", { viewport: { width: 1440, height: 900 }, colorScheme: "light" }],
    ["dunkel", "desktop", { viewport: { width: 1440, height: 900 }, colorScheme: "dark" }],
    ["hell", "mobil", { viewport: { width: 390, height: 844 }, colorScheme: "light", isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ["dunkel", "mobil", { viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ];
  const pages = [
    ["produkt-abo", "/products/quest-agent-starter"],
    ["produkt-varianten", "/products/extra-shorts"],
    ["kollektion", "/collections/all"],
    ["warenkorb", "/cart"],
    ["suche", "/search?q=shorts"],
    ["dashboard-vorschau", "/pages/dashboard"],
    ["kontakt", "/pages/kontakt"],
    ["blog", "/blogs/news"],
    ["konto", "/account/login"],
    ["passwort", "/password"],
    ["404", "/gibt-es-nicht"],
  ];
  let n = 0;
  for (const [scheme, dev, opts] of modes) {
    const { ctx, page } = await newPage(opts);
    await page.goto(B + "/");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shotDir, `${dev}-${scheme}-start-01-hero.png`) });
    n++;
    const spots = [
      ["02-loop", "#loop", 0.35],
      ["03-plattformen", ".qa-platforms__phones", null],
      ["04-dashboard", "[data-qa-dash]", null],
      ["05-preise", "[data-qa-pricing]", null],
      ["06-abschluss", "[data-qa-final]", null],
    ];
    for (const [name, sel, frac] of spots) {
      const y = await page.evaluate(
        ([s, f]) => {
          const el = document.querySelector(s);
          if (!el) return null;
          const track = f !== null ? el.querySelector(".qa-pipe__track") : null;
          if (track) return track.getBoundingClientRect().top + scrollY + (track.offsetHeight - innerHeight) * f;
          return el.getBoundingClientRect().top + scrollY - (s.includes("phones") ? 110 : 60);
        },
        [sel, frac],
      );
      if (y === null) continue;
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      // Plattformen: warten, bis die Upload-Animation durchgelaufen ist
      await page.waitForTimeout(name === "03-plattformen" ? 3200 : 1400);
      await page.screenshot({ path: path.join(shotDir, `${dev}-${scheme}-start-${name}.png`) });
      n++;
    }
    for (const [name, route] of pages) {
      await page.goto(B + route);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let yy = 0; yy < h; yy += 400) {
        await page.evaluate((v) => window.scrollTo(0, v), yy);
        await page.waitForTimeout(60);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(shotDir, `${dev}-${scheme}-${name}.png`), fullPage: true });
      n++;
    }
    // Warenkorb-Panel mit Abo-Position
    await fetch(B + "/__reset");
    await page.goto(B + "/");
    await page.locator("#preise").scrollIntoViewIfNeeded();
    await page.locator("[data-quick-add] button").first().click();
    await page.waitForSelector("[data-cart-drawer].is-open", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(shotDir, `${dev}-${scheme}-warenkorb-panel.png`) });
    n++;
    await ctx.close();
  }
  await fetch(B + "/__reset");
  check("Screenshots", null, `${n} Bilder in ${path.relative(process.cwd(), shotDir) || shotDir}`);
}

await browser.close();
await preview.close();
const failed = results.filter((r) => r.pass === false).length;
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : "\nAlle Prüfungen bestanden.");
process.exit(failed ? 1 : 0);

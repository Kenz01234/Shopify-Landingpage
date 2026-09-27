// Prüft die Shopify-Section so nah wie ohne Shop-Zugang möglich an der Wirklichkeit:
//   npm run shopify:check                 (klont Shopify Horizon in einen temporären Ordner)
//   npm run shopify:check -- pfad/horizon  (vorhandener Horizon-Checkout)
//
// 1. Shopify Theme Check auf shopify/ (0 Befunde erwartet)
// 2. Schema und JSON-Template nach Shopifys Upload-Regeln (Werte passend zu den Setting-Typen, Blocklimits)
// 3. Section mit LiquidJS rendern (Shopify-Filter nachgebildet)
// 4. Style-Isolation: berechnete Styles jedes Elements allein vs. in Horizons Seitenstruktur mit Horizons base.css,
//    Horizon-Variablen mit auffälligen Testwerten belegt → 0 Abweichungen erwartet (360–1440 px, hell/dunkel)
// 5. Schriften laden über asset_url
// 6. Theme-Editor-Simulation: section:load (inkl. erneuter Skriptausführung), section:select, block:select,
//    section:unload; Horizons Scroll-Container (.page-wrapper) für Einblendungen und „Den Loop entdecken“
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Liquid } from "liquidjs";
import { themeCheckRun } from "@shopify/theme-check-node";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const pkg = path.join(root, "shopify");
const results = [];
const check = (name, pass, info = "") => {
  results.push({ name, pass });
  console.log(`${pass === null ? "–" : pass ? "✅" : "❌"} ${name}${info ? ` – ${info}` : ""}`);
};

// 1) Theme Check – das Paket in einem Minimal-Theme (Theme Check braucht layout/, config/ und locales/)
async function themeCheck(dir) {
  const r = await themeCheckRun(dir, undefined, () => {});
  return (r.offenses ?? r).map((o) => ({
    ...o,
    file: path.relative(dir, o.uri.replace(/^file:\/\//, "")),
  }));
}
const minimal = fs.mkdtempSync(path.join(os.tmpdir(), "qa-minimal-theme-"));
for (const dir of ["sections", "assets", "templates"]) fs.cpSync(path.join(pkg, dir), path.join(minimal, dir), { recursive: true });
fs.mkdirSync(path.join(minimal, "layout"));
fs.mkdirSync(path.join(minimal, "config"));
fs.mkdirSync(path.join(minimal, "locales"));
fs.writeFileSync(
  path.join(minimal, "layout", "theme.liquid"),
  "<!doctype html>\n<html>\n  <head>\n    {{ content_for_header }}\n  </head>\n  <body>\n    {{ content_for_layout }}\n  </body>\n</html>\n",
);
fs.writeFileSync(
  path.join(minimal, "config", "settings_schema.json"),
  JSON.stringify([
    {
      name: "theme_info",
      theme_name: "Minimal",
      theme_version: "1.0.0",
      theme_author: "Quest Agent",
      theme_documentation_url: "https://example.com",
      theme_support_url: "https://example.com",
    },
  ]),
);
fs.writeFileSync(path.join(minimal, "config", "settings_data.json"), JSON.stringify({ current: {} }));
fs.writeFileSync(path.join(minimal, "locales", "en.default.json"), "{}");
const offenses = await themeCheck(minimal);
for (const o of offenses) console.log(`   ${o.check} ${o.file}: ${o.message}`);
check("Shopify Theme Check (Section-Paket in Minimal-Theme)", offenses.length === 0, `${offenses.length} Befunde`);
fs.rmSync(minimal, { recursive: true, force: true });

// 2) Schema + Template
const src = fs.readFileSync(path.join(pkg, "sections", "quest-agent-landing.liquid"), "utf8");
const schema = JSON.parse(/{% schema %}([\s\S]*?){% endschema %}/.exec(src)[1]);
const templatePath = path.join(pkg, "templates", "page.quest-agent.json");
const tpl = JSON.parse(fs.readFileSync(templatePath, "utf8")).sections.main;
const problems = [];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function validate(def, val, where) {
  if (val === undefined || val === null) return;
  const t = def.type;
  if (["text", "textarea", "html", "liquid"].includes(t) && typeof val !== "string") problems.push(`${where}: String erwartet`);
  if (t === "richtext" && val && !/^\s*(<(p|ul|ol|h[1-6])[\s>][\s\S]*<\/(p|ul|ol|h[1-6])>\s*)+$/.test(val))
    problems.push(`${where}: richtext braucht <p>/<ul>/<ol>`);
  if (t === "inline_richtext" && /<(p|ul|ol|div|h[1-6])[\s>]/.test(val)) problems.push(`${where}: inline_richtext ohne Block-Tags`);
  if (t === "url" && val && !/^(https?:\/\/|\/|shopify:\/\/|mailto:|tel:)/.test(val)) problems.push(`${where}: ungültige URL`);
  if ((t === "select" || t === "radio") && !def.options.some((o) => o.value === val)) problems.push(`${where}: ${val} ist keine Option`);
  if (t === "range") {
    const step = def.step ?? 1;
    const k = (val - def.min) / step;
    if (val < def.min || val > def.max || Math.abs(k - Math.round(k)) > 1e-9) problems.push(`${where}: ${val} passt nicht zu ${def.min}–${def.max}/${step}`);
  }
  if (t === "checkbox" && typeof val !== "boolean") problems.push(`${where}: true/false erwartet`);
  if (t === "color" && val && !HEX.test(val)) problems.push(`${where}: Hex-Farbe erwartet`);
  if (t === "image_picker" && val) problems.push(`${where}: Bild im Template verweist auf Shop-Datei`);
}
function validateDefs(settings, where) {
  const ids = settings.filter((s) => s.id).map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push(`${where}: doppelte IDs`);
  for (const s of settings.filter((x) => x.id)) {
    if (s.type === "range" && (s.max - s.min) / (s.step ?? 1) > 101) problems.push(`${where}.${s.id}: mehr als 101 Schritte`);
    validate(s, s.default, `${where}.${s.id} (Standard)`);
  }
  return Object.fromEntries(settings.filter((s) => s.id).map((s) => [s.id, s]));
}
const defs = validateDefs(schema.settings, "Schema");
if (Object.keys(defs).length > 40) problems.push("mehr als 40 Einstellungen");
const blockDefs = Object.fromEntries(schema.blocks.map((b) => [b.type, { ...b, defs: validateDefs(b.settings ?? [], `Block ${b.type}`) }]));
for (const [k, v] of Object.entries(tpl.settings ?? {}))
  defs[k] ? validate(defs[k], v, `Template.${k}`) : problems.push(`Template: unbekannte Einstellung ${k}`);
const counts = {};
for (const [id, b] of Object.entries(tpl.blocks)) {
  const bd = blockDefs[b.type];
  if (!bd) {
    problems.push(`Template: unbekannter Blocktyp ${b.type}`);
    continue;
  }
  counts[b.type] = (counts[b.type] ?? 0) + 1;
  for (const [k, v] of Object.entries(b.settings ?? {}))
    bd.defs[k] ? validate(bd.defs[k], v, `${id}.${k}`) : problems.push(`${id}: unbekannte Einstellung ${k}`);
}
for (const [t, n] of Object.entries(counts)) if (blockDefs[t].limit && n > blockDefs[t].limit) problems.push(`${n}× ${t} über dem Limit ${blockDefs[t].limit}`);
if (JSON.stringify([...tpl.block_order].sort()) !== JSON.stringify(Object.keys(tpl.blocks).sort())) problems.push("block_order passt nicht zu blocks");
if (tpl.block_order.length > (schema.max_blocks ?? 50)) problems.push("zu viele Blöcke");
if (!schema.presets?.length) problems.push("kein Preset – Section wäre im Editor nicht hinzufügbar");
problems.forEach((p) => console.log(`   ${p}`));
check("Schema und Template nach Upload-Regeln", problems.length === 0, `${tpl.block_order.length} Blöcke, ${Object.keys(defs).length} Einstellungen`);

// 3) Rendern
const engine = new Liquid();
engine.registerTag("schema", {
  parse(_t, remain) {
    const stream = this.liquid.parser.parseStream(remain);
    stream
      .on("tag:endschema", () => stream.stop())
      .on("template", () => {})
      .on("end", () => {
        throw new Error("schema nicht geschlossen");
      });
    stream.start();
  },
  render() {
    return "";
  },
});
engine.registerFilter("asset_url", (v) => `assets/${v}`);
engine.registerFilter("stylesheet_tag", (v) => `<link rel="stylesheet" href="${v}">`);
engine.registerFilter("image_url", (v) => v);
engine.registerFilter("image_tag", (v) => `<img src="${v}">`);
const SECTION_ID = "template--1__main";
async function renderSection(scheme) {
  const settings = Object.fromEntries(Object.values(defs).map((s) => [s.id, s.default ?? (s.type === "checkbox" ? false : "")]));
  Object.assign(settings, tpl.settings, {
    primary_url: "/registrieren",
    color_scheme: scheme,
  });
  const blocks = tpl.block_order.map((id) => ({
    id,
    type: tpl.blocks[id].type,
    settings: tpl.blocks[id].settings,
    shopify_attributes: `data-shopify-editor-block='{"id":"${id}"}'`,
  }));
  return engine.parseAndRender(src, {
    section: { id: SECTION_ID, settings, blocks },
    request: { design_mode: false },
  });
}
const fragments = {
  light: await renderSection("light"),
  dark: await renderSection("dark"),
};
check("Section rendert (hell/dunkel)", fragments.light.includes("data-qa-root") && fragments.dark.includes("qa-scheme-dark"));

// 4) Horizon beschaffen
let horizon = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!horizon) {
  horizon = fs.mkdtempSync(path.join(os.tmpdir(), "horizon-"));
  try {
    execFileSync("git", ["clone", "--quiet", "--depth", "1", "https://github.com/Shopify/horizon", horizon], { stdio: "inherit" });
  } catch {
    horizon = null;
  }
}
if (!horizon || !fs.existsSync(path.join(horizon, "assets", "base.css"))) {
  check("Horizon-Prüfungen", null, "Horizon nicht verfügbar – Pfad als Argument übergeben");
} else {
  try {
    // Theme Check auf Horizon + Section (so, wie es per „Theme hochladen“ installiert wird)
    const merged = fs.mkdtempSync(path.join(os.tmpdir(), "qa-horizon-theme-"));
    for (const dir of ["assets", "blocks", "config", "layout", "locales", "sections", "snippets", "templates"])
      fs.cpSync(path.join(horizon, dir), path.join(merged, dir), {
        recursive: true,
      });
    for (const dir of ["sections", "assets", "templates"])
      fs.cpSync(path.join(pkg, dir), path.join(merged, dir), {
        recursive: true,
      });
    fs.copyFileSync(templatePath, path.join(merged, "templates", "index.json"));
    const mergedOffenses = await themeCheck(merged);
    const ours = mergedOffenses.filter((o) => /quest-agent|index\.json/.test(o.file));
    const errorsTotal = mergedOffenses.filter((o) => o.severity === 0);
    for (const o of [...ours, ...errorsTotal]) console.log(`   ${o.check} ${o.file}: ${o.message}`);
    check(
      "Shopify Theme Check (Horizon + Section)",
      ours.length === 0 && errorsTotal.length === 0,
      `${mergedOffenses.length} Hinweise insgesamt, davon ${ours.length} in Quest-Agent-Dateien, ${errorsTotal.length} Fehler`,
    );
    fs.rmSync(merged, { recursive: true, force: true });

    const site = fs.mkdtempSync(path.join(os.tmpdir(), "qa-shopify-"));
    fs.cpSync(path.join(pkg, "assets"), path.join(site, "assets"), {
      recursive: true,
    });
    const base = fs.readFileSync(path.join(horizon, "assets", "base.css"), "utf8");
    fs.writeFileSync(path.join(site, "assets", "horizon-base.css"), base);
    const sentinel = [...new Set([...base.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))]
      .map((n) => {
        const v = /family/.test(n)
          ? '"Courier New", monospace'
          : /-rgb$/.test(n)
            ? "0 255 0"
            : /line-height/.test(n)
              ? "2.9"
              : /letter-spacing/.test(n)
                ? "4px"
                : /--case$/.test(n)
                  ? "uppercase"
                  : /--weight$/.test(n)
                    ? "300"
                    : /--style$/.test(n)
                      ? "italic"
                      : /color/.test(n)
                        ? "rgb(0, 255, 0)"
                        : /size/.test(n) && /font/.test(n)
                          ? "31px"
                          : /margin|padding|gap|spacing/.test(n)
                            ? "23px"
                            : /radius/.test(n)
                              ? "17px"
                              : null;
        return v && `  ${n}: ${v};`;
      })
      .filter(Boolean);
    fs.writeFileSync(path.join(site, "assets", "sentinel-vars.css"), `:root {\n  --color: rgb(0, 255, 0);\n${sentinel.join("\n")}\n}\n`);
    const head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    for (const [m, html] of Object.entries(fragments)) {
      fs.writeFileSync(path.join(site, `a-${m}.html`), `<!doctype html><html lang="de"><head>${head}</head><body style="margin:0">${html}</body></html>`);
      const horizonPage = (cls) =>
        `<!doctype html><html lang="de"${cls}><head>${head}<link rel="stylesheet" href="assets/sentinel-vars.css"><link rel="stylesheet" href="assets/horizon-base.css"></head><body class="page-width-normal"><div class="page-wrapper"><main id="MainContent" class="content-for-layout"><div id="shopify-section-${SECTION_ID}" class="shopify-section qa-section-wrapper">${html}</div></main></div></body></html>`;
      fs.writeFileSync(path.join(site, `b-${m}.html`), horizonPage(""));
      if (m === "light") fs.writeFileSync(path.join(site, "editor.html"), horizonPage(' class="shopify-design-mode"'));
    }

    const browser = await chromium.launch();
    const PROPS = [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "letter-spacing",
      "text-transform",
      "color",
      "background-color",
      "margin-top",
      "margin-bottom",
      "margin-left",
      "margin-right",
      "padding-top",
      "padding-bottom",
      "padding-left",
      "padding-right",
      "display",
      "text-decoration-line",
      "text-decoration-color",
      "text-underline-offset",
      "list-style-type",
      "border-top-width",
      "border-radius",
      "box-shadow",
      "align-items",
      "overflow-wrap",
      "height",
      "width",
    ];
    async function snapshot(file, width) {
      const p = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      await p.goto(`file://${path.join(site, file)}`);
      await p.evaluate(() => document.fonts.ready);
      // Gleicher Zustand in beiden Varianten: Demo bis zur Freigabe laufen lassen (läuft nur, solange sie sichtbar ist)
      await p.locator("[data-qa-stage]").scrollIntoViewIfNeeded();
      await p
        .waitForFunction(() => document.querySelector("[data-qa-status]")?.textContent === "Wartet auf deine Freigabe", null, { timeout: 30_000 })
        .catch(() => {});
      const snap = await p.evaluate((PROPS) => {
        const r = document.querySelector("[data-qa-root]");
        return [r, ...r.querySelectorAll("*")].map((el) => {
          const cs = getComputedStyle(el);
          return {
            name: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""),
            d: PROPS.map((k) => cs.getPropertyValue(k)),
          };
        });
      }, PROPS);
      await p.close();
      return snap;
    }
    for (const width of [1440, 768, 390, 360]) {
      for (const m of ["light", "dark"]) {
        const [a, b] = [await snapshot(`a-${m}.html`, width), await snapshot(`b-${m}.html`, width)];
        const diffs = new Set();
        a.forEach((ea, i) => PROPS.forEach((k, j) => ea.d[j] !== b[i]?.d[j] && diffs.add(`${ea.name} ${k}: ${ea.d[j]} → ${b[i]?.d[j]}`)));
        [...diffs].slice(0, 8).forEach((d) => console.log(`   ${d}`));
        check(`Horizon-CSS beeinflusst die Section nicht (${width}px, ${m === "light" ? "hell" : "dunkel"})`, diffs.size === 0, `${diffs.size} Abweichungen`);
      }
    }

    // 5) Schriften
    {
      const p = await browser.newPage();
      const failed = [];
      p.on("requestfailed", (r) => failed.push(r.url()));
      await p.goto(`file://${path.join(site, "b-light.html")}`);
      await p.evaluate(() => document.fonts.ready);
      const fonts = await p.evaluate(() => document.fonts.check('800 40px "QA Inter Tight"') && document.fonts.check('italic 400 40px "QA Instrument Serif"'));
      check("Schriften laden über asset_url", fonts && failed.length === 0, failed.join(", "));
      await p.close();
    }

    // 6) Theme-Editor
    {
      const p = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.addInitScript(() => {
        window.__listeners = [];
        const add = EventTarget.prototype.addEventListener;
        const rm = EventTarget.prototype.removeEventListener;
        EventTarget.prototype.addEventListener = function (t, fn, o) {
          window.__listeners.push({ el: this, t, fn });
          return add.call(this, t, fn, o);
        };
        EventTarget.prototype.removeEventListener = function (t, fn, o) {
          window.__listeners = window.__listeners.filter((l) => !(l.el === this && l.t === t && l.fn === fn));
          return rm.call(this, t, fn, o);
        };
      });
      await p.goto(`file://${path.join(site, "editor.html")}`);
      await p.waitForFunction(() => document.querySelector(".qa-section.qa-ready"));
      const count = () =>
        p.evaluate(() => ({
          load: window.__listeners.filter((l) => l.el === document && l.t === "shopify:section:load").length,
          toggle: window.__listeners.filter((l) => l.el === document.querySelector("[data-qa-toggle]") && l.t === "click").length,
        }));
      const detail = { sectionId: SECTION_ID };
      for (let i = 0; i < 3; i++) {
        await p.evaluate(
          async ({ html, detail }) => {
            const wrap = document.querySelector(".shopify-section");
            wrap.dispatchEvent(
              new CustomEvent("shopify:section:unload", {
                bubbles: true,
                detail,
              }),
            );
            wrap.innerHTML = html;
            for (const old of wrap.querySelectorAll("script")) {
              const s = document.createElement("script");
              s.src = old.src;
              await new Promise((r) => {
                s.onload = r;
                s.onerror = r;
                old.replaceWith(s);
              });
            }
            wrap.dispatchEvent(
              new CustomEvent("shopify:section:load", {
                bubbles: true,
                detail: { ...detail, load: true },
              }),
            );
          },
          { html: fragments.light, detail },
        );
        await p.waitForTimeout(250);
      }
      const c = await count();
      check("Editor: nach 3× Neuladen genau eine Instanz", c.load === 1 && c.toggle === 1, JSON.stringify(c));
      const toggle = p.locator("[data-qa-toggle]");
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      const s1 = await p.locator("[data-qa-status]").textContent();
      await p.waitForTimeout(2500);
      check("Editor: Pause hält die Demo an", s1 === (await p.locator("[data-qa-status]").textContent()));
      await toggle.click();
      await p.evaluate(
        (detail) =>
          document.querySelector(".shopify-section").dispatchEvent(
            new CustomEvent("shopify:section:select", {
              bubbles: true,
              detail,
            }),
          ),
        detail,
      );
      check("Editor: section:select startet die Demo neu", (await p.locator("[data-qa-status]").textContent()) === "Dein System wird eingerichtet");
      const blockSelect = await p.evaluate((detail) => {
        const d = document.querySelectorAll("details.qa-faq-item")[2];
        d.open = false;
        d.dispatchEvent(
          new CustomEvent("shopify:block:select", {
            bubbles: true,
            detail: { ...detail, blockId: "faq_3" },
          }),
        );
        const li = document.querySelectorAll(".qa-loop-item")[4];
        li.classList.remove("is-visible");
        li.dispatchEvent(
          new CustomEvent("shopify:block:select", {
            bubbles: true,
            detail: { ...detail, blockId: "step_5" },
          }),
        );
        return d.open && li.classList.contains("is-visible");
      }, detail);
      check("Editor: block:select öffnet FAQ bzw. blendet Block ein", blockSelect);
      await p.evaluate((detail) => {
        const wrap = document.querySelector(".shopify-section");
        wrap.dispatchEvent(new CustomEvent("shopify:section:unload", { bubbles: true, detail }));
        wrap.remove();
      }, detail);
      await p.waitForTimeout(1500);
      check("Editor: Entfernen ohne JavaScript-Fehler", errors.length === 0, errors.join(" | "));
      await p.close();

      const p2 = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await p2.goto(`file://${path.join(site, "b-light.html")}`);
      await p2.waitForTimeout(600);
      const reveal = await p2.evaluate(async () => {
        const w = document.querySelector(".page-wrapper");
        const scrolls = getComputedStyle(w).overflowY === "auto" && w.scrollHeight > w.clientHeight;
        for (let y = 0; y <= w.scrollHeight; y += 300) {
          w.scrollTop = y;
          await new Promise((r) => setTimeout(r, 120));
        }
        await new Promise((r) => setTimeout(r, 2500));
        const r = [...document.querySelectorAll(".qa-reveal")];
        w.scrollTop = 0;
        return {
          scrolls,
          total: r.length,
          shown: r.filter((e) => e.classList.contains("is-visible") && getComputedStyle(e).opacity === "1").length,
        };
      });
      check("Horizon-Scrollcontainer: alle Einblendungen greifen", reveal.scrolls && reveal.shown === reveal.total, `${reveal.shown}/${reveal.total}`);
      await p2.getByRole("button", { name: "Den Loop entdecken" }).click();
      await p2.waitForTimeout(1200);
      const top = await p2.evaluate(() => Math.round(document.querySelector("[data-qa-stage]").getBoundingClientRect().top));
      check("Horizon-Scrollcontainer: „Den Loop entdecken“ scrollt zur Demo", Math.abs(top) < 120, `top=${top}`);
      await p2.close();
    }
    await browser.close();
    fs.rmSync(site, { recursive: true, force: true });
  } catch (e) {
    check("Horizon-/Editor-Prüfungen vollständig durchgelaufen", false, e.message.split("\n")[0]);
  }
}

const failed = results.filter((r) => r.pass === false).length;
console.log(`\n${results.filter((r) => r.pass).length} bestanden, ${failed} fehlgeschlagen, ${results.filter((r) => r.pass === null).length} übersprungen`);
process.exit(failed ? 1 : 0);

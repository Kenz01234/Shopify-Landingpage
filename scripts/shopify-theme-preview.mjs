#!/usr/bin/env node
/**
 * Lokale Vorschau des Shopify-Themes „Quest Agent“ (shopify/theme) mit Beispieldaten.
 *
 * Kein Ersatz für einen echten Shop: Liquid wird hier mit LiquidJS gerendert, Shopify-Tags und -Filter sind
 * nachgebaut, Preise/Abos/Checkout sind Attrappen. Der Zweck ist, alle Seiten in hell/dunkel, Desktop/Mobil
 * anzusehen und den Warenkorb-Ablauf (AJAX-API + Section Rendering) im Browser zu prüfen, bevor das Theme
 * in einen echten Shop geladen wird.
 *
 *   npm run shopify:preview          → http://localhost:4545
 *
 * Als Modul: import { startPreview } from "./shopify-theme-preview.mjs"
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const THEME_DIR = path.resolve(HERE, "..", "shopify", "theme");

/* ------------------------------------------------------------------ Hilfen */
const read = (dir, ...p) => fs.readFileSync(path.join(dir, ...p), "utf8");
const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const kwargs = (args) => Object.fromEntries(args.filter((a) => Array.isArray(a) && a.length === 2 && typeof a[0] === "string"));
const handleize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function splitArgs(markup) {
  // Kommagetrennt, Kommas in Anführungszeichen bleiben erhalten
  const parts = [];
  let cur = "";
  let q = null;
  for (const ch of markup) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
    } else if (ch === "'" || ch === '"') {
      q = ch;
      cur += ch;
    } else if (ch === ",") {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/* -------------------------------------------------------------- Geldbeträge */
const EUR = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (c) => `${EUR.format((Number(c) || 0) / 100)} €`;
const moneyNoZeros = (c) => {
  const v = (Number(c) || 0) / 100;
  return Number.isInteger(v) ? `${v} €` : money(c);
};

/* ------------------------------------------------------------ Beispieldaten */
function img(file, alt = "") {
  return { src: `/assets/${file}`, alt, width: 1600, height: 1000, aspect_ratio: 1.6 };
}
function media(id, file, alt) {
  const preview = img(file, alt);
  return { id, media_type: "image", alt, preview_image: preview, src: preview.src, width: 1600, height: 1000 };
}
function makeProduct({ id, handle, title, description, variants, plan, media: m = [], requiresPlan = false }) {
  const groups = plan ? [{ id: `g${id}`, name: "Abo", app_id: "shopify_subscriptions", selling_plans: [plan] }] : [];
  const vs = variants.map((v, i) => {
    const allocations = plan ? [{ selling_plan_id: plan.id, selling_plan: plan, price: v.price, compare_at_price: v.price, per_delivery_price: v.price }] : [];
    return {
      id: v.id,
      title: v.title ?? "Default Title",
      option1: v.options?.[0] ?? "Default Title",
      options: v.options ?? ["Default Title"],
      price: v.price,
      compare_at_price: v.compare_at_price ?? null,
      available: v.available !== false,
      sku: v.sku ?? `${handle}-${i + 1}`,
      requires_selling_plan: requiresPlan,
      selling_plan_allocations: allocations,
      featured_media: v.media ?? null,
    };
  });
  const options = variants[0].options
    ? [{ name: "Paket", position: 1, values: [...new Set(variants.map((v) => v.options[0]))] }]
    : [{ name: "Title", position: 1, values: ["Default Title"] }];
  const first = vs.find((v) => v.available) ?? vs[0];
  const prices = vs.map((v) => v.price);
  const p = {
    id,
    handle,
    title,
    description,
    url: `/products/${handle}`,
    vendor: "Quest Agent",
    type: plan ? "Abo" : "Zusatz",
    available: vs.some((v) => v.available),
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    price_varies: Math.min(...prices) !== Math.max(...prices),
    compare_at_price: null,
    variants: vs,
    has_only_default_variant: !variants[0].options,
    options: options.map((o) => o.name),
    options_with_values: options.map((o) => ({ ...o, selected_value: o.values[0] })),
    selling_plan_groups: groups,
    requires_selling_plan: requiresPlan,
    selected_selling_plan: null,
    selected_or_first_available_variant: first,
    media: m,
    featured_media: m[0] ?? null,
    images: m.map((x) => x.preview_image),
    featured_image: m[0]?.preview_image ?? null,
    tags: [],
  };
  return p;
}

export function sampleData() {
  const starter = makeProduct({
    id: 1001,
    handle: "quest-agent-starter",
    title: "Quest Agent Starter",
    description:
      "<p>15 Videos à 7 Minuten und 30 Shorts pro Monat. Shorts erscheinen auf allen Plattformen, die du wählst – YouTube, Instagram und TikTok – und zählen dabei nur einmal.</p><p>Jede Veröffentlichung braucht deine Freigabe.</p>",
    variants: [{ id: 4001, price: 6000, sku: "QA-STARTER" }],
    plan: { id: 7001, name: "Monatlich · jederzeit kündbar", description: "Verlängert sich monatlich, Kündigung im Kundenkonto.", options: [] },
    requiresPlan: true,
  });
  const studio = makeProduct({
    id: 1002,
    handle: "quest-agent-studio",
    title: "Quest Agent Studio",
    description: "<p>30 Videos à 10 Minuten und 30 Shorts pro Monat, für mehr Takt und längere Videos.</p>",
    variants: [{ id: 4002, price: 10000, sku: "QA-STUDIO" }],
    plan: { id: 7002, name: "Monatlich · jederzeit kündbar", description: "Verlängert sich monatlich, Kündigung im Kundenkonto.", options: [] },
    requiresPlan: true,
  });
  const m1 = media(9001, "qa-scene-space.svg", "Beispielszene Weltall");
  const m2 = media(9002, "qa-scene-tech.svg", "Beispielszene Technik");
  const extra = makeProduct({
    id: 1003,
    handle: "extra-shorts",
    title: "Extra-Kontingent Shorts",
    description: "<p>Zusätzliche Shorts für einen Monat. Einmalkauf, verfällt am Ende des Abrechnungszeitraums.</p>",
    variants: [
      { id: 4031, price: 1500, options: ["10 Shorts"], title: "10 Shorts", media: m1 },
      { id: 4032, price: 2800, compare_at_price: 3000, options: ["20 Shorts"], title: "20 Shorts", media: m2 },
      { id: 4033, price: 6500, options: ["50 Shorts"], title: "50 Shorts", available: false },
    ],
    media: [m1, m2],
  });
  const products = [starter, studio, extra];
  const collection = (handle, title, items, description = "") => ({
    id: handle,
    handle,
    title,
    description,
    url: `/collections/${handle}`,
    products: items,
    products_count: items.length,
    all_products_count: items.length,
    featured_image: items.find((p) => p.featured_image)?.featured_image ?? null,
    sort_by: "manual",
    default_sort_by: "manual",
    sort_options: [
      { value: "manual", name: "Empfohlen" },
      { value: "price-ascending", name: "Preis, aufsteigend" },
      { value: "price-descending", name: "Preis, absteigend" },
    ],
    filters: [],
  });
  const all = collection("all", "Alle Produkte", products);
  const plans = collection("plaene", "Pläne", [starter, studio], "<p>Starter oder Studio – beide mit Freigabe vor jeder Veröffentlichung.</p>");
  const collections = [plans, all];
  collections.all = all;
  collections.plaene = plans;
  const link = (title, url, active = false) => ({ title, url, active, child_active: false, links: [], type: "http_link" });
  const linklists = {
    "main-menu": { handle: "main-menu", title: "Hauptmenü", links: [link("Start", "/"), link("Pläne", "/collections/plaene"), link("Dashboard", "/pages/dashboard"), link("Kontakt", "/pages/kontakt")] },
    footer: {
      handle: "footer",
      title: "Mehr",
      links: [link("Suche", "/search"), link("Blog", "/blogs/news"), link("Kontakt", "/pages/kontakt")],
    },
  };
  const article = (handle, title, days, excerpt) => ({
    id: handle,
    handle,
    title,
    url: `/blogs/news/${handle}`,
    author: "Quest-Team",
    published_at: new Date(Date.UTC(2026, 8, 27 - days, 9, 0)).toISOString(),
    excerpt: `<p>${excerpt}</p>`,
    content: `<p>${excerpt}</p><h2>Was du mitnehmen kannst</h2><p>Plane feste Uploadtage, prüfe jedes Video in Ruhe und gib erst dann frei. So bleibt die Kontrolle bei dir.</p><ul><li>Uploadplan festlegen</li><li>Vorschau prüfen</li><li>Freigeben</li></ul>`,
    image: days === 3 ? img("qa-scene-ocean.svg", "Ozean") : null,
    excerpt_or_content: `<p>${excerpt}</p>`,
    object_type: "article",
    tags: [],
    comments_count: 0,
  });
  const blog = {
    handle: "news",
    title: "Neuigkeiten",
    url: "/blogs/news",
    articles: [
      article("drei-plattformen", "Shorts auf drei Plattformen – mit einer Freigabe", 3, "Ab sofort erscheinen Shorts auf YouTube, Instagram und TikTok – jede Plattform mit eigenem Status."),
      article("freigabe-inbox", "So funktioniert die Freigabe-Inbox", 12, "Nichts geht ohne dich online. Warum die Freigabe an genau eine Version gebunden ist."),
    ],
  };
  blog.articles_count = blog.articles.length;
  const pages = {
    dashboard: { handle: "dashboard", title: "Dein Dashboard", url: "/pages/dashboard", content: "<p>So sieht dein Kundenbereich aus.</p>", template_suffix: "dashboard" },
    kontakt: { handle: "kontakt", title: "Kontakt", url: "/pages/kontakt", content: "<p>Schreib uns – wir melden uns in der Regel innerhalb eines Werktags.</p>", template_suffix: "contact" },
    impressum: {
      handle: "impressum",
      title: "Impressum",
      url: "/pages/impressum",
      content: "<p><strong>Beispieltext.</strong> Hier stehen später die Pflichtangaben deines Unternehmens.</p><h2>Kontakt</h2><p>E-Mail: siehe Kontaktseite</p>",
    },
  };
  const customer = {
    first_name: "Alex",
    last_name: "Beispiel",
    name: "Alex Beispiel",
    email: "alex@example.com",
    orders_count: 1,
    orders: [
      {
        name: "#1001",
        created_at: "2026-09-20T10:00:00Z",
        total_price: 6000,
        financial_status_label: "Bezahlt",
        fulfillment_status_label: "Nicht erforderlich",
        customer_url: "/account/orders/1001",
        line_items: [{ title: "Quest Agent Starter", quantity: 1, final_line_price: 6000 }],
      },
    ],
    addresses: [],
    default_address: null,
  };
  const policy = (handle, title, body) => ({ handle, title, url: `/policies/${handle}`, body });
  const policies = [
    policy("legal-notice", "Impressum", "<p><strong>Beispieltext.</strong> Hier stehen die Pflichtangaben deines Unternehmens (Name, Anschrift, Kontakt, Registereintrag, Umsatzsteuer-ID).</p>"),
    policy("privacy-policy", "Datenschutzerklärung", "<h2>1. Verantwortliche Stelle</h2><p>Beispieltext – ersetze ihn in Shopify unter Einstellungen → Richtlinien.</p><h2>2. Welche Daten wir verarbeiten</h2><p>Bestelldaten, Kontaktdaten und Nutzungsdaten der App.</p>"),
    policy("terms-of-service", "Allgemeine Geschäftsbedingungen", "<p>Beispieltext der AGB.</p>"),
    policy("refund-policy", "Widerrufsrecht", "<p>Beispieltext zur Widerrufsbelehrung.</p>"),
    policy("subscription-policy", "Kündigungsrichtlinie", "<p>Abos verlängern sich monatlich und sind jederzeit zum Ende des Abrechnungszeitraums kündbar (Beispieltext).</p>"),
  ];
  return { products, collections, linklists, blog, pages, customer, policies };
}

/* ---------------------------------------------------------------- Warenkorb */
function createCart(data) {
  const lines = [];
  const variantIndex = new Map();
  for (const p of data.products) for (const v of p.variants) variantIndex.set(Number(v.id), { p, v });
  function build() {
    const items = lines.map((l, i) => {
      const { p, v } = variantIndex.get(l.id);
      const alloc = l.selling_plan ? v.selling_plan_allocations.find((a) => a.selling_plan_id === l.selling_plan) : null;
      const unit = alloc ? alloc.price : v.price;
      return {
        id: v.id,
        key: `${v.id}:${l.selling_plan ?? 0}`,
        quantity: l.quantity,
        variant_id: v.id,
        product_id: p.id,
        title: p.has_only_default_variant ? p.title : `${p.title} - ${v.title}`,
        product_title: p.title,
        variant_title: p.has_only_default_variant ? null : v.title,
        price: unit,
        line_price: unit * l.quantity,
        original_line_price: (v.compare_at_price > unit ? v.compare_at_price : unit) * l.quantity,
        final_price: unit,
        final_line_price: unit * l.quantity,
        url: `${p.url}?variant=${v.id}`,
        url_to_remove: `/cart/change?line=${i + 1}&quantity=0`,
        image: v.featured_media?.preview_image ?? p.featured_image,
        product: p,
        variant: v,
        selling_plan_allocation: alloc ? { ...alloc, selling_plan: alloc.selling_plan } : null,
        properties: {},
        line_level_discount_allocations: [],
        requires_shipping: false,
      };
    });
    const total = items.reduce((s, it) => s + it.final_line_price, 0);
    return {
      token: "preview-cart",
      note: "",
      attributes: {},
      items,
      item_count: items.reduce((s, it) => s + it.quantity, 0),
      total_price: total,
      original_total_price: total,
      items_subtotal_price: total,
      total_discount: 0,
      taxes_included: true,
      cart_level_discount_applications: [],
      currency: { iso_code: "EUR" },
      requires_shipping: false,
      empty: items.length === 0,
    };
  }
  function add(id, quantity, sellingPlan) {
    const hit = variantIndex.get(Number(id));
    if (!hit) return { error: { status: 404, message: "Cart Error", description: "Variante nicht gefunden." } };
    if (!hit.v.available) return { error: { status: 422, message: "Cart Error", description: `${hit.p.title} ist ausverkauft.` } };
    const plan = sellingPlan ? Number(sellingPlan) : null;
    if (hit.p.requires_selling_plan && !plan)
      return { error: { status: 422, message: "Cart Error", description: "Für dieses Produkt muss ein Abo-Plan gewählt werden." } };
    if (plan && !hit.v.selling_plan_allocations.some((a) => a.selling_plan_id === plan))
      return { error: { status: 422, message: "Cart Error", description: "Abo-Plan passt nicht zum Produkt." } };
    const existing = lines.find((l) => l.id === Number(id) && (l.selling_plan ?? null) === plan);
    if (existing) existing.quantity += quantity;
    else lines.push({ id: Number(id), quantity, selling_plan: plan });
    const cart = build();
    return { item: cart.items.find((it) => it.variant_id === Number(id) && (it.selling_plan_allocation?.selling_plan_id ?? null) === plan) };
  }
  function change(line, quantity) {
    const l = lines[line - 1];
    if (!l) return { error: { status: 400, message: "Cart Error", description: "Position nicht gefunden." } };
    if (quantity <= 0) lines.splice(line - 1, 1);
    else l.quantity = quantity;
    return {};
  }
  function clear() {
    lines.length = 0;
  }
  return { build, add, change, clear };
}

/* ------------------------------------------------------------- Liquid-Engine */
function createEngine(themeDir, locale) {
  const engine = new Liquid({
    root: [path.join(themeDir, "snippets")],
    partials: path.join(themeDir, "snippets"),
    extname: ".liquid",
    strictFilters: true,
    strictVariables: false,
    cache: false,
  });

  engine.registerTag("schema", {
    parse(_t, remain) {
      const stream = this.liquid.parser.parseStream(remain);
      stream
        .on("tag:endschema", () => stream.stop())
        .on("template", () => {})
        .on("end", () => {
          throw new Error("{% schema %} nicht geschlossen");
        });
      stream.start();
    },
    render() {
      return "";
    },
  });
  engine.registerTag("layout", {
    parse(token) {
      this.value = token.args.trim();
    },
    render(ctx) {
      ctx.globals.__layout = this.value.replace(/['"]/g, "");
      return "";
    },
  });

  const FORM_ACTIONS = {
    product: "/cart/add",
    contact: "/contact",
    customer: "/contact#newsletter",
    storefront_password: "/password",
    customer_login: "/account/login",
    create_customer: "/account",
    recover_customer_password: "/account/recover",
    reset_customer_password: "/account/reset",
    activate_customer_password: "/account/activate",
  };
  engine.registerTag("form", {
    parse(token, remain) {
      this.args = splitArgs(token.args);
      this.templates = [];
      const stream = this.liquid.parser.parseStream(remain);
      stream
        .on("tag:endform", () => stream.stop())
        .on("template", (tpl) => this.templates.push(tpl))
        .on("end", () => {
          throw new Error("{% form %} nicht geschlossen");
        });
      stream.start();
    },
    *render(ctx, emitter) {
      const type = String(yield this.liquid.evalValue(this.args[0], ctx));
      if (!FORM_ACTIONS[type]) throw new Error(`Unbekannter Formulartyp ${type}`);
      const attrs = { method: "post", action: FORM_ACTIONS[type], "accept-charset": "UTF-8" };
      if (type === "product") attrs.enctype = "multipart/form-data";
      for (const part of this.args.slice(1)) {
        const m = /^([A-Za-z][\w-]*)\s*:\s*([\s\S]+)$/.exec(part);
        if (!m) continue; // Positionsargument (z. B. product)
        attrs[m[1]] = yield this.liquid.evalValue(m[2], ctx);
      }
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
        .join("");
      emitter.write(`<form${attrStr}><input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
      ctx.push({ form: { errors: null, posted_successfully: false, email: "", name: "", body: "", id: attrs.id ?? null } });
      for (const tpl of this.templates) yield this.liquid.renderer.renderTemplates([tpl], ctx, emitter);
      ctx.pop();
      emitter.write("</form>");
    },
  });

  engine.registerTag("paginate", {
    parse(token, remain) {
      const m = /^(.+?)\s+by\s+(.+)$/.exec(token.args.trim());
      if (!m) throw new Error(`paginate: ${token.args}`);
      this.collection = m[1];
      this.by = m[2];
      this.templates = [];
      const stream = this.liquid.parser.parseStream(remain);
      stream
        .on("tag:endpaginate", () => stream.stop())
        .on("template", (tpl) => this.templates.push(tpl))
        .on("end", () => {
          throw new Error("{% paginate %} nicht geschlossen");
        });
      stream.start();
    },
    *render(ctx, emitter) {
      const list = (yield this.liquid.evalValue(this.collection, ctx)) ?? [];
      const by = Number(yield this.liquid.evalValue(this.by, ctx)) || 12;
      const pages = Math.max(1, Math.ceil(list.length / by));
      ctx.push({
        paginate: { current_page: 1, current_offset: 0, items: list.length, page_size: by, pages, previous: null, next: pages > 1 ? { url: "?page=2", title: "Weiter" } : null, parts: [] },
      });
      yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
      ctx.pop();
    },
  });

  // Übersetzungen inkl. Pluralformen und Platzhaltern
  engine.registerFilter("t", (key, ...args) => {
    const kw = kwargs(args);
    let v = String(key)
      .split(".")
      .reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), locale);
    if (v && typeof v === "object" && "count" in kw) v = Number(kw.count) === 1 ? (v.one ?? v.other) : (v.other ?? v.one);
    if (typeof v !== "string") throw new Error(`Übersetzung fehlt: ${key}`);
    return v.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, n) => (n in kw ? String(kw[n] ?? "") : ""));
  });
  engine.registerFilter("money", money);
  engine.registerFilter("money_with_currency", (c) => `${money(c)} EUR`);
  engine.registerFilter("money_without_trailing_zeros", moneyNoZeros);
  engine.registerFilter("money_without_currency", (c) => EUR.format((Number(c) || 0) / 100));
  engine.registerFilter("asset_url", (v) => `/assets/${v}`);
  engine.registerFilter("stylesheet_tag", (v) => `<link href="${v}" rel="stylesheet" type="text/css" media="all" />`);
  engine.registerFilter("script_tag", (v) => `<script src="${v}" type="text/javascript"></script>`);
  engine.registerFilter("preload_tag", (v, ...args) => {
    const kw = kwargs(args);
    const extra = Object.entries(kw)
      .map(([k, val]) => ` ${k}="${escapeHtml(val)}"`)
      .join("");
    return `<link href="${v}" rel="preload"${extra}>`;
  });
  engine.registerFilter("image_url", (v, ...args) => {
    if (!v) return "";
    const src = typeof v === "string" ? v : (v.src ?? v.preview_image?.src ?? "");
    const kw = kwargs(args);
    return kw.width ? `${src}?width=${kw.width}` : src;
  });
  engine.registerFilter("image_tag", (v, ...args) => {
    const kw = kwargs(args);
    const attrs = { src: v, alt: kw.alt ?? "", loading: kw.loading, fetchpriority: kw.fetchpriority, sizes: kw.sizes, class: kw.class, width: kw.width ?? 1600, height: kw.height ?? 1000 };
    return `<img${Object.entries(attrs)
      .filter(([, x]) => x !== undefined && x !== null)
      .map(([k, x]) => ` ${k}="${escapeHtml(x)}"`)
      .join("")}>`;
  });
  engine.registerFilter("media_tag", (m) => `<img src="${escapeHtml(m?.preview_image?.src ?? "")}" alt="${escapeHtml(m?.alt ?? "")}">`);
  engine.registerFilter(
    "placeholder_svg_tag",
    (name, cls) =>
      `<svg class="${escapeHtml(cls ?? "")}" data-placeholder="${escapeHtml(name)}" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="525" fill="currentColor" opacity=".06"/><path d="M160 360l90-120 70 90 45-50 60 80z" fill="currentColor" opacity=".18"/></svg>`,
  );
  engine.registerFilter(
    "payment_type_svg_tag",
    (type, cls) =>
      `<svg class="${escapeHtml(cls ?? "")}" viewBox="0 0 38 24" width="38" height="24" role="img" aria-label="${escapeHtml(type)}"><rect width="38" height="24" rx="3" fill="#fff" stroke="#ccc"/><text x="19" y="15" font-size="7" text-anchor="middle" fill="#333">${escapeHtml(String(type).slice(0, 6))}</text></svg>`,
  );
  engine.registerFilter(
    "payment_button",
    () => `<div class="shopify-payment-button"><button type="button" class="shopify-payment-button__button" disabled>Express-Zahlung (Vorschau)</button></div>`,
  );
  engine.registerFilter("default_errors", (errors) =>
    errors ? `<ul>${[].concat(errors.messages ?? errors).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : "",
  );
  engine.registerFilter("time_tag", (d, fmt) => {
    const date = new Date(d);
    const txt = date.toLocaleDateString("de-DE", fmt === "date" ? { day: "2-digit", month: "2-digit", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
    return `<time datetime="${date.toISOString()}">${txt}</time>`;
  });
  engine.registerFilter("handle", handleize);
  engine.registerFilter("handleize", handleize);
  engine.registerFilter("format_code", (c) => String(c ?? "").replace(/(.{4})(?=.)/g, "$1 "));
  engine.registerFilter("format_address", (a) => (a ? `<p>${escapeHtml([a.name, a.address1, a.zip, a.city].filter(Boolean).join("<br>"))}</p>` : ""));
  engine.registerFilter("structured_data", (p) =>
    JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p?.title, offers: { "@type": "Offer", price: (p?.price ?? 0) / 100, priceCurrency: "EUR" } }),
  );
  return engine;
}

/* ------------------------------------------------------ Einstellungen/Sections */
function schemaOf(src) {
  const m = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(src);
  return m ? JSON.parse(m[1]) : { settings: [] };
}
function resolveSettings(defs, values, lookups) {
  const out = {};
  for (const d of defs ?? []) {
    if (!d.id) continue;
    let v = values && d.id in values ? values[d.id] : d.default;
    if (v === undefined) v = d.type === "checkbox" ? false : null;
    if (d.type === "link_list") v = v ? (lookups.linklists[v] ?? null) : null;
    if (d.type === "product") v = v ? (lookups.products.find((p) => p.handle === v) ?? null) : null;
    if (d.type === "collection") v = v ? (lookups.collections[v] ?? null) : null;
    if (d.type === "image_picker" && v && typeof v === "string") v = null;
    out[d.id] = v;
  }
  return out;
}

export function createShop({ themeDir = THEME_DIR, settingsOverrides = {}, sectionOverrides = {}, linkPlans = true } = {}) {
  // Wie im eingerichteten Shop: Die Preis-Blöcke sind mit den Abo-Produkten verknüpft (linkPlans: false zeigt den Zustand davor)
  const blockOverrides = linkPlans ? { "qa-pricing": [{ product: "quest-agent-starter" }, { product: "quest-agent-studio" }] } : {};
  const locale = JSON.parse(read(themeDir, "locales", "de.default.json"));
  const engine = createEngine(themeDir, locale);
  const data = sampleData();
  const cart = createCart(data);
  const lookups = { linklists: data.linklists, products: data.products, collections: data.collections };
  const globalSchema = JSON.parse(read(themeDir, "config", "settings_schema.json"));
  const settingsData = JSON.parse(read(themeDir, "config", "settings_data.json"));
  const globalDefs = globalSchema.flatMap((g) => g.settings ?? []);
  const settings = resolveSettings(globalDefs, { ...(settingsData.current ?? {}), ...settingsOverrides }, lookups);

  const sectionCache = new Map();
  function loadSection(type) {
    if (!sectionCache.has(type)) {
      const src = read(themeDir, "sections", `${type}.liquid`);
      sectionCache.set(type, { src, schema: schemaOf(src), tpl: engine.parse(src, path.join(themeDir, "sections", `${type}.liquid`)) });
    }
    return sectionCache.get(type);
  }

  function globalsFor(req) {
    return {
      shop: {
        name: "Quest Agent",
        url: req.origin,
        secure_url: req.origin,
        domain: new URL(req.origin).host,
        description: "Faceless-YouTube-Automation mit Freigabe.",
        currency: "EUR",
        money_format: "{{amount_with_comma_separator}} €",
        taxes_included: true,
        customer_accounts_enabled: true,
        customer_accounts_optional: true,
        enabled_payment_types: ["visa", "master", "paypal", "apple_pay", "klarna"],
        password_message: "Wir öffnen in Kürze.",
        policies: data.policies,
      },
      settings,
      routes: {
        root_url: "/",
        cart_url: "/cart",
        cart_add_url: "/cart/add",
        cart_change_url: "/cart/change",
        cart_update_url: "/cart/update",
        search_url: "/search",
        account_url: "/account",
        account_login_url: "/account/login",
        account_register_url: "/account/register",
        account_logout_url: "/account/logout",
        account_addresses_url: "/account/addresses",
        collections_url: "/collections",
        all_products_collection_url: "/collections/all",
        predictive_search_url: "/search/suggest",
      },
      cart: cart.build(),
      request: { design_mode: Boolean(req.designMode), page_type: req.template.name, locale: { iso_code: "de", root_url: "/" }, origin: req.origin, path: req.path, host: new URL(req.origin).host },
      template: req.template,
      linklists: data.linklists,
      collections: data.collections,
      all_products: Object.fromEntries(data.products.map((p) => [p.handle, p])),
      pages: data.pages,
      customer: req.customer ?? null,
      canonical_url: req.origin + req.path,
      page_title: req.title,
      page_description: req.description ?? null,
      current_page: 1,
      current_tags: null,
      content_for_header: `<script>window.Shopify = { shop: "preview.myshopify.com", currency: { active: "EUR", rate: "1.0" }, locale: "de", designMode: ${Boolean(req.designMode)} };</script>`,
      powered_by_link: "",
      ...req.objects,
    };
  }

  async function renderSection({ type, id, data: sdata = {}, group = null }, globals) {
    if (sdata.disabled) return "";
    const { schema, tpl } = loadSection(type);
    const override = sectionOverrides[id] ?? sectionOverrides[type] ?? {};
    const blockDefs = Object.fromEntries((schema.blocks ?? []).map((b) => [b.type, b]));
    const blocksData = sdata.blocks ?? {};
    const order = sdata.block_order ?? Object.keys(blocksData);
    const blocks = order
      .filter((bid) => blocksData[bid] && !blocksData[bid].disabled)
      .map((bid, i) => {
        const b = blocksData[bid];
        const def = blockDefs[b.type];
        if (!def) throw new Error(`Section ${type}: unbekannter Blocktyp ${b.type}`);
        return {
          id: bid,
          type: b.type,
          settings: resolveSettings(def.settings, { ...b.settings, ...(blockOverrides[type]?.[i] ?? {}) }, lookups),
          shopify_attributes: `data-shopify-editor-block="${escapeHtml(JSON.stringify({ id: bid, type: b.type }))}"`,
        };
      });
    const section = { id, settings: resolveSettings(schema.settings, { ...(sdata.settings ?? {}), ...override }, lookups), blocks, location: group ?? "template", index: 1 };
    let html;
    try {
      html = await engine.render(tpl, { section }, { globals });
    } catch (e) {
      throw new Error(`Section ${type} (${id}): ${e.message}`);
    }
    const tag = schema.tag ?? "div";
    const cls = ["shopify-section", group ? `shopify-section-group-${group}` : null, schema.class].filter(Boolean).join(" ");
    return `<${tag} id="shopify-section-${id}" class="${cls}">${html}</${tag}>`;
  }

  function templateJson(name) {
    return JSON.parse(read(themeDir, "templates", `${name}.json`));
  }

  async function renderGroup(group, globals) {
    const g = JSON.parse(read(themeDir, "sections", `${group}.json`));
    const parts = [];
    for (const key of g.order) parts.push(await renderSection({ type: g.sections[key].type, id: `sections--q__${key}`, data: g.sections[key], group }, globals));
    return parts.join("\n");
  }

  // {% section %} und {% sections %} brauchen die Render-Funktionen – daher hier registriert
  engine.registerTag("section", {
    parse(token) {
      this.name = token.args.trim().replace(/['"]/g, "");
    },
    *render(ctx, emitter) {
      emitter.write(yield renderSection({ type: this.name, id: this.name }, ctx.globals));
    },
  });
  engine.registerTag("sections", {
    parse(token) {
      this.name = token.args.trim().replace(/['"]/g, "");
    },
    *render(ctx, emitter) {
      emitter.write(yield renderGroup(this.name, ctx.globals));
    },
  });

  async function renderPage(req) {
    const t = req.template;
    if (t.suffix) {
      const base = `${t.directory ? `${t.directory}/` : ""}${t.name}.${t.suffix}`;
      if (!fs.existsSync(path.join(themeDir, "templates", `${base}.json`)) && !fs.existsSync(path.join(themeDir, "templates", `${base}.liquid`))) t.suffix = null;
    }
    const key = t.suffix ? `${t.directory ? `${t.directory}/` : ""}${t.name}.${t.suffix}` : `${t.directory ? `${t.directory}/` : ""}${t.name}`;
    const globals = globalsFor(req);
    let content;
    let layout = "theme";
    if (req.content != null) {
      content = req.content; // von Shopify selbst gerenderte Seiten (z. B. Richtlinien)
    } else if (fs.existsSync(path.join(themeDir, "templates", `${key}.liquid`))) {
      content = await engine.parseAndRender(read(themeDir, "templates", `${key}.liquid`), {}, { globals });
      if (globals.__layout === "none") return content;
    } else {
      const tj = templateJson(key);
      if (tj.layout === false) layout = null;
      else if (typeof tj.layout === "string") layout = tj.layout;
      const parts = [];
      for (const sk of tj.order) parts.push(await renderSection({ type: tj.sections[sk].type, id: `template--q__${sk}`, data: tj.sections[sk] }, globals));
      content = parts.join("\n");
    }
    if (!layout) return content;
    return engine.parseAndRender(read(themeDir, "layout", `${layout}.liquid`), { content_for_layout: content }, { globals });
  }

  async function renderSectionsFor(req, ids) {
    const globals = globalsFor(req);
    const out = {};
    const t = req.template;
    const key = t.suffix ? `${t.name}.${t.suffix}` : t.name;
    let tj = null;
    try {
      tj = templateJson(key);
    } catch {
      tj = null;
    }
    for (const id of ids) {
      if (id.startsWith("template--q__") && tj) {
        const sk = id.slice("template--q__".length);
        out[id] = tj.sections[sk] ? await renderSection({ type: tj.sections[sk].type, id, data: tj.sections[sk] }, globals) : null;
      } else if (fs.existsSync(path.join(themeDir, "sections", `${id}.liquid`))) {
        out[id] = await renderSection({ type: id, id }, globals);
      } else out[id] = null;
    }
    return out;
  }

  return { data, cart, settings, renderPage, renderSectionsFor, engine };
}

/* ------------------------------------------------------------------ Routing */
function routeFor(pathname, url, shop) {
  const { data } = shop;
  const T = (name, suffix = null, directory = null) => ({ name, suffix, directory });
  const q = url.searchParams;
  if (pathname === "/") return { template: T("index"), title: "Quest Agent – Faceless-Kanal auf Autopilot" };
  let m;
  if ((m = /^\/products\/([\w-]+)$/.exec(pathname))) {
    const product = data.products.find((p) => p.handle === m[1]);
    if (!product) return null;
    const vid = Number(q.get("variant"));
    const selected = product.variants.find((v) => v.id === vid) ?? product.selected_or_first_available_variant;
    const p = { ...product, selected_or_first_available_variant: selected, options_with_values: product.options_with_values.map((o) => ({ ...o, selected_value: selected.options[o.position - 1] })) };
    return { template: T("product"), title: product.title, objects: { product: p, collection: null } };
  }
  if (pathname === "/collections") return { template: T("list-collections"), title: "Kollektionen" };
  if ((m = /^\/collections\/([\w-]+)$/.exec(pathname))) {
    const c = data.collections[m[1]];
    if (!c) return null;
    const sorted = { ...c, sort_by: q.get("sort_by") ?? c.default_sort_by };
    if (sorted.sort_by === "price-ascending") sorted.products = [...c.products].sort((a, b) => a.price - b.price);
    if (sorted.sort_by === "price-descending") sorted.products = [...c.products].sort((a, b) => b.price - a.price);
    return { template: T("collection"), title: c.title, objects: { collection: sorted } };
  }
  if (pathname === "/cart") return { template: T("cart"), title: "Warenkorb" };
  if ((m = /^\/policies\/([\w-]+)$/.exec(pathname))) {
    const pol = data.policies.find((x) => x.handle === m[1]);
    if (!pol) return null;
    // So liefert Shopify Richtlinienseiten aus: eigenes Markup innerhalb des Theme-Layouts
    return {
      template: T("policy"),
      title: pol.title,
      content: `<div class="shopify-policy__container"><div class="shopify-policy__title"><h1>${pol.title}</h1></div><div class="shopify-policy__body"><div class="rte">${pol.body}</div></div></div>`,
    };
  }
  if (pathname === "/search") {
    const terms = q.get("q") ?? "";
    const hit = (t) => t.toLowerCase().includes(terms.toLowerCase());
    const results = terms
      ? [
          ...data.products.filter((p) => hit(p.title + p.description)).map((p) => ({ ...p, object_type: "product" })),
          ...Object.values(data.pages)
            .filter((pg) => hit(pg.title + pg.content))
            .map((pg) => ({ ...pg, object_type: "page" })),
          ...data.blog.articles.filter((a) => hit(a.title + a.content)),
        ]
      : [];
    return {
      template: T("search"),
      title: "Suche",
      objects: { search: { performed: Boolean(terms), terms, results, results_count: results.length, types: ["product", "page", "article"] } },
    };
  }
  if ((m = /^\/pages\/([\w-]+)$/.exec(pathname))) {
    const page = data.pages[m[1]];
    if (!page) return null;
    return { template: T("page", page.template_suffix ?? null), title: page.title, objects: { page } };
  }
  if (pathname === "/blogs/news") return { template: T("blog"), title: data.blog.title, objects: { blog: data.blog } };
  if ((m = /^\/blogs\/news\/([\w-]+)$/.exec(pathname))) {
    const article = data.blog.articles.find((a) => a.handle === m[1]);
    if (!article) return null;
    return { template: T("article"), title: article.title, objects: { blog: data.blog, article } };
  }
  const account = {
    "/account/login": "login",
    "/account/register": "register",
    "/account": "account",
    "/account/addresses": "addresses",
    "/account/orders/1001": "order",
    "/account/reset": "reset_password",
    "/account/activate": "activate_account",
  };
  if (account[pathname]) {
    const name = account[pathname];
    const loggedIn = ["account", "addresses", "order"].includes(name);
    return {
      template: T(name, null, "customers"),
      title: "Konto",
      customer: loggedIn ? data.customer : null,
      objects: name === "order" ? { order: data.customer.orders[0] } : {},
    };
  }
  if (pathname === "/password") return { template: T("password"), title: "Bald geöffnet" };
  if (pathname === "/gift_cards/preview")
    return {
      template: T("gift_card"),
      title: "Geschenkgutschein",
      objects: { gift_card: { title: "Geschenkgutschein", code: "ABCD1234EFGH5678", balance: 2500, initial_value: 2500, enabled: true, expired: false, inactive: false, shop: { name: "Quest Agent" }, qr_identifier: "x", pass_url: null } },
    };
  return null;
}

const MIME = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };

export function startPreview({ port = 4545, themeDir = THEME_DIR, settingsOverrides = {}, sectionOverrides = {}, linkPlans = true, designMode = false, log = false } = {}) {
  const shop = createShop({ themeDir, settingsOverrides, sectionOverrides, linkPlans });
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`;
    const url = new URL(req.url, origin);
    const send = (status, body, type = "text/html; charset=utf-8", headers = {}) => {
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
      res.end(body);
    };
    const json = (status, obj) => send(status, JSON.stringify(obj), "application/json");
    const bodyRequest = async () => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      return new Request(url, { method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
    };
    // Rendering-Kontext der Seite, für die Sections neu gerendert werden (sections_url)
    const contextFor = (p) => {
      const u = new URL(p || "/", origin);
      const r = routeFor(u.pathname, u, shop) ?? { template: { name: "404" }, title: "404" };
      return { ...r, origin, path: u.pathname, designMode };
    };
    try {
      requests.push(`${req.method} ${url.pathname}`);
      if (log) console.log(req.method, url.pathname + url.search);
      if (url.pathname.startsWith("/assets/")) {
        const file = path.join(themeDir, "assets", path.basename(url.pathname));
        if (!fs.existsSync(file)) return send(404, "not found", "text/plain");
        return send(200, fs.readFileSync(file), MIME[path.extname(file)] ?? "application/octet-stream", { "Cache-Control": "no-cache" });
      }
      if (url.pathname === "/cart.js" || url.pathname === "/cart.json") return json(200, shop.cart.build());
      if (url.pathname === "/search/suggest.json") {
        // Nachbau der Predictive-Search-Antwort (resources.results.products/pages/articles)
        const term = (url.searchParams.get("q") ?? "").toLowerCase();
        const hit = (t) => t.toLowerCase().includes(term);
        const d = shop.data;
        return json(200, {
          resources: {
            results: {
              products: d.products
                .filter((p) => hit(p.title + p.description))
                .map((p) => ({ title: p.title, url: p.url, handle: p.handle, price: (p.price / 100).toFixed(2), available: p.available, image: p.featured_image?.src ?? null, featured_image: p.featured_image ? { url: p.featured_image.src, alt: "" } : null })),
              pages: Object.values(d.pages)
                .filter((pg) => hit(pg.title + pg.content))
                .map((pg) => ({ title: pg.title, url: pg.url, handle: pg.handle })),
              articles: d.blog.articles.filter((a) => hit(a.title + a.content)).map((a) => ({ title: a.title, url: a.url, handle: a.handle, image: a.image?.src ?? null })),
            },
          },
        });
      }
      if (url.pathname === "/cart/add.js" || url.pathname === "/cart/add") {
        const r = await bodyRequest();
        const fd = await r.formData();
        const result = shop.cart.add(fd.get("id"), Number(fd.get("quantity") ?? 1) || 1, fd.get("selling_plan") || null);
        if (url.pathname === "/cart/add") return send(302, "", "text/plain", { Location: result.error ? "/cart?error=1" : "/cart" });
        if (result.error) return json(result.error.status, result.error);
        const out = { ...result.item };
        delete out.product;
        delete out.variant;
        const ids = String(fd.get("sections") ?? "").split(",").filter(Boolean);
        if (ids.length) out.sections = await shop.renderSectionsFor(contextFor(fd.get("sections_url")), ids);
        return json(200, out);
      }
      if (url.pathname === "/cart/change.js") {
        const r = await bodyRequest();
        const body = await r.json();
        const result = shop.cart.change(Number(body.line), Number(body.quantity));
        if (result.error) return json(result.error.status, result.error);
        const out = shop.cart.build();
        if (body.sections?.length) out.sections = await shop.renderSectionsFor(contextFor(body.sections_url), [].concat(body.sections));
        return json(200, out);
      }
      if (url.pathname === "/cart/change") {
        shop.cart.change(Number(url.searchParams.get("line")), Number(url.searchParams.get("quantity")));
        return send(302, "", "text/plain", { Location: "/cart" });
      }
      if (url.pathname === "/cart" && req.method === "POST") {
        const r = await bodyRequest();
        const fd = await r.formData();
        // Von hinten nach vorn, damit entfernte Positionen die Nummerierung nicht verschieben
        const updates = fd.getAll("updates[]").map(Number);
        for (let i = updates.length - 1; i >= 0; i--) shop.cart.change(i + 1, updates[i]);
        return send(302, "", "text/plain", { Location: fd.has("checkout") ? "/checkout" : "/cart" });
      }
      if (url.pathname === "/checkout") {
        const c = shop.cart.build();
        return send(
          200,
          `<!doctype html><meta charset="utf-8"><title>Checkout (Vorschau)</title><body style="font:16px system-ui;padding:40px"><h1 data-mock-checkout>Checkout (Attrappe)</h1><p>Im echten Shop übernimmt hier Shopify. Positionen: ${c.item_count}, Summe: ${money(c.total_price)}</p><ul>${c.items.map((i) => `<li>${escapeHtml(i.title)} × ${i.quantity}${i.selling_plan_allocation ? ` – ${escapeHtml(i.selling_plan_allocation.selling_plan.name)}` : ""}</li>`).join("")}</ul></body>`,
        );
      }
      if (url.pathname === "/__reset") {
        shop.cart.clear();
        return json(200, { ok: true });
      }
      const sectionsParam = url.searchParams.get("sections");
      const route = routeFor(url.pathname, url, shop);
      // ?view=xyz rendert wie bei Shopify das alternative Template (z. B. collection.anmelden)
      if (route && url.searchParams.get("view")) route.template = { ...route.template, suffix: url.searchParams.get("view") };
      const ctx = route ? { ...route, origin, path: url.pathname, designMode } : { template: { name: "404", suffix: null, directory: null }, title: "Seite nicht gefunden", origin, path: url.pathname, designMode };
      if (sectionsParam) return json(200, await shop.renderSectionsFor(ctx, sectionsParam.split(",")));
      return send(route ? 200 : 404, await shop.renderPage(ctx));
    } catch (e) {
      console.error(e);
      return send(500, `<pre>${escapeHtml(e.stack || e.message)}</pre>`);
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, shop, requests, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4545);
  const { url } = await startPreview({ port, log: true, designMode: process.env.DESIGN_MODE === "1", linkPlans: !process.argv.includes("--ohne-produkte") });
  console.log(`Theme-Vorschau (Beispieldaten, kein echter Shop): ${url}`);
  console.log("Seiten: /  /products/quest-agent-starter  /products/extra-shorts  /collections/all  /cart  /search?q=shorts  /pages/dashboard  /pages/kontakt  /blogs/news  /account/login  /account  /password  /404");
}

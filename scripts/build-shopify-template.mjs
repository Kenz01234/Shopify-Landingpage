// Erzeugt shopify/templates/page.quest-agent.json aus den Website-Inhalten (lib/marketing-content.ts).
import fs from "node:fs";

const src = fs.readFileSync("lib/marketing-content.ts", "utf8");
const grab = (name) => {
  const m = new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`).exec(src);
  // eslint-disable-next-line no-new-func
  return Function(`return (${m[1]});`)();
};
const steps = grab("LOOP_STEPS");
const faq = grab("FAQ");
const benefits = [
  ["◎", "Ohne Gesicht", "Keine Kamera, kein Auftritt."],
  ["♪", "Ohne Einsprechen", "Eine KI-Stimme spricht deine Skripte."],
  ["✦", "Dein eigenes System", "Aus deiner Nische und deinen Vorbildern."],
  ["▶", "Videos & Shorts", "Aus einem automatisierten Prozess."],
  ["◷", "Dein Rhythmus", "Tage, Uhrzeiten, Zeitzone – du bestimmst."],
  ["✓", "Prüfen statt produzieren", "Du gibst frei, Quest erledigt den Rest."],
];
const blocks = {};
const order = [];
benefits.forEach(([icon, title, text], i) => {
  const id = `benefit_${i + 1}`;
  blocks[id] = { type: "benefit", settings: { icon, title, text } };
  order.push(id);
});
steps.forEach((s, i) => {
  const id = `step_${i + 1}`;
  blocks[id] = { type: "step", settings: { title: s.title, text: s.text, who: s.who } };
  order.push(id);
});
faq.forEach((f, i) => {
  const id = `faq_${i + 1}`;
  blocks[id] = { type: "faq", settings: { question: f.q, answer: `<p>${f.a}</p>` } };
  order.push(id);
});
const template = {
  sections: {
    main: {
      type: "quest-agent-landing",
      blocks,
      block_order: order,
      settings: { show_loop: true, show_pricing: true, color_scheme: "light", scene: "space" },
    },
  },
  order: ["main"],
};
fs.writeFileSync("shopify/templates/page.quest-agent.json", JSON.stringify(template, null, 2) + "\n");
console.log(`Template mit ${order.length} Blöcken geschrieben.`);

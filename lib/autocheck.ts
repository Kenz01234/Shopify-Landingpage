import type { SourceNote } from "@/providers/types";

/**
 * Automatische Prüfung einer Inhaltsversion. Das Ergebnis ist eine Entscheidungshilfe –
 * niemals eine Freigabe. Inhaltliche Qualität und Rechtestatus werden getrennt ausgewiesen.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type CheckItem = { key: string; label: string; status: CheckStatus; detail: string };

export type AutoCheckResult = {
  checkedAt: string;
  content: { status: "pass" | "warn" | "fail"; items: CheckItem[] };
  rights: { status: "clear" | "unclear"; items: { title: string; status: string; note?: string | null }[] };
  isDemo: boolean;
};

const RISKY_CLAIMS = [
  /garantiert/i,
  /100\s?%/i,
  /reich werden/i,
  /sicheres? einkommen/i,
  /passives? einkommen ohne/i,
  /schnell reich/i,
  /wunderheil/i,
];

export function runAutoCheck(input: {
  title: string;
  description: string;
  tags: string[];
  script: string;
  thumbnailText: string;
  format: "longform" | "short";
  targetSeconds: number;
  sources: SourceNote[];
  media: { kind: string; durationSec?: number | null }[];
  isDemo: boolean;
  stage: "topic" | "script" | "final";
}): AutoCheckResult {
  const items: CheckItem[] = [];
  const t = input.title.trim();
  items.push(
    t.length === 0
      ? { key: "title", label: "Titel", status: "fail", detail: "Titel fehlt." }
      : t.length > 100
        ? { key: "title", label: "Titel", status: "fail", detail: `Titel hat ${t.length} Zeichen – YouTube erlaubt höchstens 100.` }
        : t.length > 70
          ? { key: "title", label: "Titel", status: "warn", detail: `${t.length} Zeichen – könnte in der Vorschau abgeschnitten werden.` }
          : { key: "title", label: "Titel", status: "pass", detail: `${t.length} Zeichen.` },
  );
  const d = input.description;
  items.push(
    d.length > 5000
      ? { key: "description", label: "Beschreibung", status: "fail", detail: "Mehr als 5.000 Zeichen." }
      : d.trim().length < 20
        ? { key: "description", label: "Beschreibung", status: "warn", detail: "Sehr kurz – ein bis zwei Sätze Kontext helfen." }
        : { key: "description", label: "Beschreibung", status: "pass", detail: `${d.length} Zeichen.` },
  );
  const tagChars = input.tags.join(",").length;
  items.push(
    tagChars > 500
      ? { key: "tags", label: "Tags", status: "fail", detail: "Tags sind zusammen länger als 500 Zeichen." }
      : { key: "tags", label: "Tags", status: input.tags.length ? "pass" : "warn", detail: input.tags.length ? `${input.tags.length} Tags.` : "Keine Tags." },
  );
  if (input.thumbnailText.length > 40) {
    items.push({ key: "thumb", label: "Thumbnail-Text", status: "warn", detail: "Länger als 40 Zeichen – auf kleinen Bildschirmen schwer lesbar." });
  } else {
    items.push({ key: "thumb", label: "Thumbnail-Text", status: "pass", detail: "Kurz und lesbar." });
  }

  const allText = `${input.title}\n${input.description}\n${input.script}\n${input.thumbnailText}`;
  const risky = RISKY_CLAIMS.filter((r) => r.test(allText));
  items.push(
    risky.length
      ? { key: "claims", label: "Versprechen & Aussagen", status: "warn", detail: "Enthält Formulierungen wie „garantiert“ oder Einkommensversprechen – bitte prüfen." }
      : { key: "claims", label: "Versprechen & Aussagen", status: "pass", detail: "Keine riskanten Versprechen gefunden." },
  );

  const words = input.script.split(/\s+/).filter(Boolean).length;
  if (input.isDemo) {
    items.push({ key: "length", label: "Skriptlänge", status: "info", detail: `${words} Wörter – Demo-Skript ist bewusst gekürzt, Länge wird nicht bewertet.` });
  } else {
    const expected = Math.round((input.targetSeconds / 60) * 140);
    const ratio = expected ? words / expected : 1;
    items.push(
      ratio < 0.6 || ratio > 1.4
        ? { key: "length", label: "Skriptlänge", status: "warn", detail: `${words} Wörter – erwartet ca. ${expected} für die Ziellänge.` }
        : { key: "length", label: "Skriptlänge", status: "pass", detail: `${words} Wörter, passt zur Ziellänge.` },
    );
  }

  const facts = input.sources.filter((s) => s.type === "fact");
  if (input.stage !== "topic") {
    items.push(
      facts.length >= 2
        ? {
            key: "sources",
            label: "Quellenhinweise",
            status: input.isDemo ? "info" : "pass",
            detail: input.isDemo ? "Demo-Platzhalter – im Live-Betrieb echte Quellen." : `${facts.length} Quellen zugeordnet.`,
          }
        : { key: "sources", label: "Quellenhinweise", status: "warn", detail: "Weniger als zwei Quellen zugeordnet." },
    );
  }

  if (input.stage === "final") {
    const main = input.media.find((m) => m.kind === (input.format === "short" ? "short" : "video"));
    if (!main) {
      items.push({ key: "media", label: "Mediendatei", status: "fail", detail: "Keine Videodatei vorhanden." });
    } else if (input.isDemo) {
      items.push({
        key: "media",
        label: "Mediendatei",
        status: "info",
        detail: `Demo-Ausschnitt (${Math.round(main.durationSec ?? 0)} s) statt vollständiger Länge.`,
      });
    } else if (main.durationSec && main.durationSec > input.targetSeconds * 1.15) {
      items.push({ key: "media", label: "Mediendatei", status: "warn", detail: "Video ist deutlich länger als geplant." });
    } else {
      items.push({ key: "media", label: "Mediendatei", status: "pass", detail: "Videodatei vorhanden." });
    }
  }

  const content = items.some((i) => i.status === "fail") ? "fail" : items.some((i) => i.status === "warn") ? "warn" : "pass";
  const rightsItems = input.sources
    .filter((s) => s.type !== "fact")
    .map((s) => ({ title: s.title, status: s.rightsStatus, note: s.note }));
  const unclear = rightsItems.some((r) => r.status === "unknown" || r.status === "needs_review");
  return {
    checkedAt: new Date().toISOString(),
    content: { status: content, items },
    rights: { status: unclear ? "unclear" : "clear", items: rightsItems },
    isDemo: input.isDemo,
  };
}

export const RIGHTS_LABEL: Record<string, string> = {
  own_production: "Eigenes Material",
  demo_fixture: "Demo-Material",
  licensed: "Lizenziert",
  public_domain: "Gemeinfrei / CC0",
  unknown: "Rechtestatus unbekannt",
  needs_review: "Muss geprüft werden",
  not_applicable: "Nicht zutreffend",
};

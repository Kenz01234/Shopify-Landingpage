import type { NicheKey } from "@/components/art/niche-scene";
import type { ConfigSnapshot, ResearchResult, ScriptResult, SourceNote } from "@/providers/types";

/**
 * Demo-Inhalte für die simulierte Produktion. Alles hier ist Beispielmaterial und wird in der
 * Oberfläche als Demo gekennzeichnet. Es werden keine echten Quellen oder Live-Daten behauptet.
 */

type Topic = { title: string; thumb: string; tags: string[]; hook: string; parts: string[] };

const BANK: Record<NicheKey, Topic[]> = {
  space: [
    {
      title: "Was, wenn es noch andere Welten gibt?",
      thumb: "ANDERE WELTEN?",
      tags: ["Exoplaneten", "Weltall", "Astronomie"],
      hook: "Irgendwo da draußen kreist vielleicht gerade ein Planet, auf dem es regnet – aus Wasser, genau wie hier.",
      parts: [
        "Seit den 1990er-Jahren haben Forschende tausende Planeten außerhalb unseres Sonnensystems nachgewiesen. Die meisten sehen wir nicht direkt, sondern an winzigen Helligkeitsschwankungen ihrer Sterne.",
        "Besonders spannend ist die sogenannte habitable Zone: der Abstand zu einem Stern, in dem flüssiges Wasser möglich wäre. Das ist noch kein Beweis für Leben – aber ein guter Ort, um zu suchen.",
        "Neue Teleskope analysieren das Licht, das durch die Atmosphären solcher Planeten fällt. So lässt sich abschätzen, welche Gase dort vorkommen.",
      ],
    },
    {
      title: "Warum ist der Nachthimmel eigentlich dunkel?",
      thumb: "WARUM DUNKEL?",
      tags: ["Kosmologie", "Olbers-Paradoxon", "Weltall"],
      hook: "Wenn es unzählige Sterne gibt – warum ist der Himmel nachts dann nicht taghell?",
      parts: [
        "Diese Frage hat einen Namen: das Olbersche Paradoxon. Es beschäftigt Astronominnen und Astronomen seit Jahrhunderten.",
        "Ein Teil der Antwort: Das Universum hat ein endliches Alter. Licht von sehr weit entfernten Sternen hat uns schlicht noch nicht erreicht.",
        "Dazu kommt, dass sich das Universum ausdehnt. Licht wird auf seinem Weg gestreckt und verschiebt sich in Bereiche, die unser Auge nicht sieht.",
      ],
    },
    {
      title: "Was passiert in einem Schwarzen Loch?",
      thumb: "KEIN ZURÜCK",
      tags: ["Schwarzes Loch", "Physik", "Weltall"],
      hook: "Es gibt eine Grenze im All, hinter der nicht einmal Licht zurückkommt.",
      parts: [
        "Diese Grenze heißt Ereignishorizont. Alles, was sie überschreitet, bleibt für Beobachter draußen für immer verborgen.",
        "Schwarze Löcher entstehen unter anderem, wenn sehr massereiche Sterne am Ende ihres Lebens in sich zusammenstürzen.",
        "Obwohl wir sie nicht direkt sehen, verraten sie sich durch ihre Wirkung: heißes Gas, das um sie kreist, leuchtet hell auf.",
      ],
    },
  ],
  history: [
    {
      title: "Pompeji: Die Stadt, die über Nacht verschwand",
      thumb: "79 N. CHR.",
      tags: ["Pompeji", "Antike", "Geschichte"],
      hook: "Im Jahr 79 nach Christus ging für eine ganze Stadt der Alltag abrupt zu Ende.",
      parts: [
        "Der Ausbruch des Vesuvs begrub Pompeji unter Asche und Bimsstein. Genau das hat die Stadt über Jahrhunderte konserviert.",
        "Bei Ausgrabungen kamen Straßen, Wandmalereien und Alltagsgegenstände zum Vorschein – ein seltener Blick in das Leben der Antike.",
        "Bis heute wird dort geforscht, und jede neue Grabung ergänzt unser Bild davon, wie die Menschen damals gelebt haben.",
      ],
    },
    {
      title: "Wie die Seidenstraße die Welt verband",
      thumb: "DIE SEIDENSTRASSE",
      tags: ["Seidenstraße", "Handel", "Geschichte"],
      hook: "Lange bevor es Flugzeuge gab, reisten Waren und Ideen über Tausende Kilometer.",
      parts: [
        "Die Seidenstraße war kein einzelner Weg, sondern ein Netz aus Handelsrouten zwischen Asien, dem Nahen Osten und Europa.",
        "Neben Seide wurden Gewürze, Papier und Metallwaren gehandelt – und genauso wichtig: Wissen, Religionen und Techniken.",
        "Viele Städte entlang der Routen wurden dadurch zu Knotenpunkten, an denen Kulturen einander begegneten.",
      ],
    },
    {
      title: "Warum baute man Burgen auf Hügeln?",
      thumb: "BURGEN-TAKTIK",
      tags: ["Mittelalter", "Burgen", "Geschichte"],
      hook: "Eine Burg auf einem Hügel ist nicht nur schön anzusehen – sie ist eine Rechnung.",
      parts: [
        "Von oben ließ sich das Umland überblicken. Angreifer waren früh zu sehen und mussten bergauf kämpfen.",
        "Gleichzeitig war eine Burg ein Verwaltungszentrum: Hier wurden Abgaben gesammelt und Recht gesprochen.",
        "Der Bau war aufwendig – Wasserversorgung und Transport von Baumaterial waren oft die größten Herausforderungen.",
      ],
    },
  ],
  ocean: [
    {
      title: "Was lebt in 4.000 Metern Tiefe?",
      thumb: "4.000 M TIEF",
      tags: ["Tiefsee", "Meer", "Biologie"],
      hook: "Dort unten ist es kalt, stockdunkel – und trotzdem voller Leben.",
      parts: [
        "In der Tiefsee herrscht enormer Druck. Lebewesen dort haben Körper, die genau an diese Bedingungen angepasst sind.",
        "Viele Tiere ernähren sich von dem, was von oben herabsinkt – Forschende nennen das Meeresschnee.",
        "Bei jeder Expedition werden neue Arten entdeckt. Große Teile der Tiefsee sind bis heute nicht erforscht.",
      ],
    },
    {
      title: "Warum leuchten Tiere in der Tiefsee?",
      thumb: "LEBENDES LICHT",
      tags: ["Biolumineszenz", "Tiefsee", "Meer"],
      hook: "In der ewigen Dunkelheit machen viele Tiere ihr eigenes Licht.",
      parts: [
        "Dieses Phänomen heißt Biolumineszenz: Licht entsteht durch eine chemische Reaktion im Körper.",
        "Es dient zum Anlocken von Beute, zur Tarnung oder um Partner zu finden.",
        "Manche Tiere nutzen Licht sogar zur Verteidigung – ein plötzlicher Blitz kann Angreifer verwirren.",
      ],
    },
    {
      title: "Der Marianengraben einfach erklärt",
      thumb: "FAST 11 KM TIEF",
      tags: ["Marianengraben", "Ozean", "Geografie"],
      hook: "Wenn man den höchsten Berg der Erde hineinstellen würde, wäre seine Spitze noch unter Wasser.",
      parts: [
        "Der Marianengraben im Pazifik ist die tiefste bekannte Stelle der Ozeane – fast elf Kilometer tief.",
        "Er entsteht dort, wo sich eine Erdplatte unter eine andere schiebt.",
        "Nur sehr wenige Tauchfahrten haben den Grund bisher erreicht.",
      ],
    },
  ],
  nature: [
    {
      title: "Der Wald, der miteinander spricht",
      thumb: "WURZEL-NETZ",
      tags: ["Wald", "Pilze", "Natur"],
      hook: "Unter jedem Waldspaziergang liegt ein Netzwerk, das wir kaum wahrnehmen.",
      parts: [
        "Pilzfäden verbinden sich mit den Wurzeln vieler Bäume. Diese Partnerschaft heißt Mykorrhiza.",
        "Über dieses Geflecht können Nährstoffe ausgetauscht werden – wie genau und wie viel, wird noch erforscht.",
        "Für den Wald ist diese unsichtbare Zusammenarbeit ein wichtiger Teil seiner Widerstandskraft.",
      ],
    },
    {
      title: "Warum Zugvögel sich nicht verfliegen",
      thumb: "INNERER KOMPASS",
      tags: ["Zugvögel", "Orientierung", "Natur"],
      hook: "Tausende Kilometer ohne Karte – und trotzdem ans Ziel.",
      parts: [
        "Zugvögel orientieren sich unter anderem am Stand der Sonne und an den Sternen.",
        "Viele Arten können zudem das Magnetfeld der Erde wahrnehmen.",
        "Auch Landmarken wie Küsten und Gebirge helfen bei der Navigation.",
      ],
    },
  ],
  tech: [
    {
      title: "Wie ein Chip in Nanosekunden denkt",
      thumb: "MILLIARDEN SCHALTER",
      tags: ["Prozessor", "Technik", "Computer"],
      hook: "In deinem Handy schalten gerade Milliarden winziger Schalter – immer wieder.",
      parts: [
        "Diese Schalter heißen Transistoren. Sie kennen nur zwei Zustände: an oder aus.",
        "Aus vielen solcher Zustände entstehen Zahlen, Buchstaben, Bilder – alles, was ein Computer verarbeitet.",
        "Moderne Chips takten so schnell, dass ein einzelner Rechenschritt nur Bruchteile einer Nanosekunde dauert.",
      ],
    },
    {
      title: "Wie GPS deine Position kennt",
      thumb: "SIGNALE AUS DEM ALL",
      tags: ["GPS", "Satelliten", "Technik"],
      hook: "Dein Handy weiß, wo du bist – dank Uhren, die im All kreisen.",
      parts: [
        "Satelliten senden laufend Signale mit einem sehr genauen Zeitstempel aus.",
        "Aus den Laufzeiten mehrerer Signale berechnet dein Gerät die Entfernungen – und daraus die Position.",
        "Damit das funktioniert, müssen sogar Effekte der Relativitätstheorie berücksichtigt werden.",
      ],
    },
  ],
};

export function sceneForNiche(niche: string, seed = ""): NicheKey {
  const n = niche.toLowerCase();
  if (/(weltall|kosmos|space|astro|planet|stern|universum)/.test(n)) return "space";
  if (/(geschicht|histor|antik|mittelalter|krieg|kaiser|römer|burg)/.test(n)) return "history";
  if (/(meer|tiefsee|ozean|ocean|wasser|fisch|wal)/.test(n)) return "ocean";
  if (/(natur|wald|tier|pflanz|garten|vogel|wildlife)/.test(n)) return "nature";
  if (/(technik|tech|ki|computer|software|chip|elektr|zukunft)/.test(n)) return "tech";
  const keys: NicheKey[] = ["space", "history", "ocean", "nature", "tech"];
  return keys[hash(seed || niche) % keys.length];
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickTopic(scene: NicheKey, seed: string, offset = 0) {
  const list = BANK[scene];
  return list[(hash(seed) + offset) % list.length];
}

export function demoResearch(config: ConfigSnapshot, jobId: string, revision: number, format: "longform" | "short"): ResearchResult {
  const scene = sceneForNiche(config.niche, config.name);
  const topic = pickTopic(scene, jobId, revision);
  const proposals = [0, 1, 2].map((o) => pickTopic(scene, jobId, revision + o).title);
  const unknownClip = hash(jobId) % 2 === 0;
  const sources: SourceNote[] = [
    {
      id: "s1",
      type: "fact",
      title: "Demo-Quellenhinweis 1 (Platzhalter)",
      note: "Im Live-Betrieb liefert die Recherche echte Quellen mit Link. Hier steht bewusst keine erfundene Quelle.",
      rightsStatus: "not_applicable",
    },
    {
      id: "s2",
      type: "fact",
      title: "Demo-Quellenhinweis 2 (Platzhalter)",
      note: "Faktenprüfung erfolgt im Live-Betrieb gegen die zugeordneten Quellen.",
      rightsStatus: "not_applicable",
    },
    {
      id: "m1",
      type: "footage",
      title: `Quest-Agent-Demografik „${scene}“`,
      publisher: "Quest Agent (eigene Grafik)",
      note: "Im Code gezeichnete Beispielgrafik, frei nutzbar im Projekt.",
      rightsStatus: "own_production",
    },
  ];
  if (unknownClip && format === "longform") {
    sources.push({
      id: "m2",
      type: "footage",
      title: "Gefundener Beispiel-Clip (Platzhalter)",
      note: "Fundstück aus der Recherche. Lizenz nicht geprüft – ein gefundener Clip ist nicht automatisch nutzbar.",
      rightsStatus: "unknown",
    });
  }
  sources.push({
    id: "v1",
    type: "voice",
    title: `KI-Stimme: ${config.voiceLabel}`,
    note: "Demo-Vertonung mit lokaler Beispielstimme (Thorsten-Voice, CC0) – nicht ElevenLabs.",
    rightsStatus: "public_domain",
  });
  const referenceHint = config.referenceChannels.length
    ? `Orientierung an ${config.referenceChannels.length} Referenzkanal${config.referenceChannels.length === 1 ? "" : "en"} (nur Stil-Signale, keine Übernahme von Inhalten).`
    : "Keine Referenzkanäle hinterlegt.";
  return {
    topic: topic.title,
    proposals,
    summary: `Nische „${config.niche}“ für ${config.audience}. ${referenceHint} Vorgeschlagen: „${topic.title}“.`,
    sources,
    scene,
  };
}

const INTROS: Record<string, string> = {
  sachlich: "Schauen wir uns das Schritt für Schritt an.",
  spannend: "Und die Antwort ist überraschender, als du denkst.",
  locker: "Klingt kompliziert? Ist es gar nicht – versprochen.",
  ruhig: "Nimm dir einen Moment. Wir gehen der Frage in Ruhe nach.",
};

export function demoScript(
  config: ConfigSnapshot,
  jobId: string,
  revision: number,
  format: "longform" | "short",
  topicTitle?: string,
  revisionNote?: string | null,
): ScriptResult {
  const scene = sceneForNiche(config.niche, config.name);
  const list = BANK[scene];
  const topic = list.find((t) => t.title === topicTitle) ?? pickTopic(scene, jobId, revision);
  const intro = INTROS[config.tone] ?? INTROS.sachlich;
  const hook = revision > 0 ? `${topic.hook} Heute mit einem neuen Blickwinkel.` : topic.hook;
  const body =
    format === "short"
      ? [hook, topic.parts[0], "Mehr dazu im ausführlichen Video auf dem Kanal."]
      : [hook, intro, ...topic.parts, "Wenn dich das Thema interessiert, schau gern beim nächsten Video wieder vorbei."];
  const script = body.join("\n\n");
  const title = format === "short" ? `${topic.title} #shorts` : topic.title;
  const description =
    format === "short"
      ? `${topic.hook} #shorts`
      : `${topic.hook}\n\nIn diesem Video: ${topic.parts.map((p) => p.split(".")[0]).join(" · ")}.\n\nHinweis: Dieses Video wurde mit KI-Unterstützung erstellt (Skript und Stimme) und vor der Veröffentlichung geprüft.`;
  void revisionNote;
  return { script, title: title.slice(0, 100), description, tags: topic.tags, thumbnailText: topic.thumb };
}

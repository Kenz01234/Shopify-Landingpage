import { z } from "zod";
import { ASSUMPTIONS, PLANS, type PlanKey } from "@/lib/plans";
import { isValidTimeZone, parseLocalTime } from "@/lib/time";
import { parseYouTubeChannel } from "@/lib/youtube-url";
import { DEMO_VOICES } from "@/lib/voices";

/** Gemeinsame Validierung für Wizard (Client) und API (Server). Der Server prüft immer erneut. */

export const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "Englisch" },
  { value: "es", label: "Spanisch" },
  { value: "fr", label: "Französisch" },
] as const;

export const TONES = [
  { value: "sachlich", label: "Sachlich & fundiert" },
  { value: "spannend", label: "Spannend & erzählend" },
  { value: "locker", label: "Locker & nahbar" },
  { value: "ruhig", label: "Ruhig & atmosphärisch" },
] as const;

export const STYLES = [
  { value: "doku", label: "Dokumentarisch" },
  { value: "erklaer", label: "Erklärvideo" },
  { value: "listicle", label: "Top-Listen" },
  { value: "story", label: "Storytelling" },
] as const;

export const REVIEW_MODES = [
  {
    value: "final_only",
    label: "Nur das fertige Ergebnis freigeben",
    text: "Quest produziert komplett; du prüfst Video, Shorts und Texte vor der Planung.",
  },
  {
    value: "topic_and_final",
    label: "Thema vorab bestätigen + fertiges Ergebnis",
    text: "Du bestätigst jedes Thema, bevor produziert wird – und gibst am Ende frei.",
  },
  {
    value: "script_and_final",
    label: "Skript vorab bestätigen + fertiges Ergebnis",
    text: "Du prüfst das Skript vor Vertonung und Schnitt – und gibst am Ende frei.",
  },
] as const;

const slotSchema = z.object({
  format: z.enum(["longform", "short"]),
  weekday: z.number().int().min(1).max(7),
  localTime: z.string().refine((t) => parseLocalTime(t) !== null, "Uhrzeit im Format HH:MM"),
});
export type SlotInput = z.infer<typeof slotSchema>;

export const step1Schema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60, "Höchstens 60 Zeichen"),
  niche: z.string().trim().min(2, "Bitte eine Nische angeben").max(80, "Höchstens 80 Zeichen"),
  topics: z.array(z.string().trim().min(2).max(40)).max(8, "Höchstens 8 Themen").default([]),
  audience: z.string().trim().min(2, "Bitte die Zielgruppe beschreiben").max(160, "Höchstens 160 Zeichen"),
  language: z.enum(["de", "en", "es", "fr"]),
});

export const step2Schema = z.object({
  referenceChannels: z
    .array(z.string())
    .min(1, "Mindestens ein Referenzkanal")
    .max(ASSUMPTIONS.maxReferenceChannels, `Höchstens ${ASSUMPTIONS.maxReferenceChannels} Kanäle`)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((raw, i) => {
        const r = parseYouTubeChannel(raw);
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: r.error, path: [i] });
          return;
        }
        if (seen.has(r.value.url)) ctx.addIssue({ code: "custom", message: "Dieser Kanal ist doppelt.", path: [i] });
        seen.add(r.value.url);
      });
    }),
});

export const step3Schema = z
  .object({
    tone: z.enum(TONES.map((t) => t.value) as [string, ...string[]]),
    style: z.enum(STYLES.map((t) => t.value) as [string, ...string[]]),
    voiceKey: z.string().min(1, "Bitte eine Stimme wählen"),
    longformEnabled: z.boolean(),
    shortsEnabled: z.boolean(),
    shortPlatforms: z.array(z.enum(["youtube", "instagram", "tiktok"])).max(3),
  })
  .refine((v) => v.longformEnabled || v.shortsEnabled, { message: "Mindestens ein Format aktivieren", path: ["longformEnabled"] })
  .refine((v) => !v.shortsEnabled || v.shortPlatforms.length > 0, { message: "Bitte mindestens eine Plattform für Shorts wählen", path: ["shortPlatforms"] });

export const step4Base = z.object({
  longformPerPeriod: z.number().int().min(0),
  longformMinutes: z.number().int().min(1),
  shortsPerPeriod: z.number().int().min(0),
  shortSeconds: z.number().int().min(ASSUMPTIONS.shortMinSeconds).max(ASSUMPTIONS.shortMaxSeconds),
});

export const step5Schema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Unbekannte Zeitzone"),
  slots: z.array(slotSchema).max(42, "Zu viele Slots"),
});

export const step6Schema = z.object({
  reviewMode: z.enum(["final_only", "topic_and_final", "script_and_final"]),
});

export const systemInputSchema = step1Schema
  .merge(step2Schema)
  .merge(
    z.object({
      tone: z.string(),
      style: z.string(),
      voiceKey: z.string(),
      longformEnabled: z.boolean(),
      shortsEnabled: z.boolean(),
      shortPlatforms: z.array(z.enum(["youtube", "instagram", "tiktok"])).max(3).default(["youtube"]),
    }),
  )
  .merge(step4Base)
  .merge(step5Schema)
  .merge(step6Schema);

export type SystemInput = z.infer<typeof systemInputSchema>;

export type Allocation = { longform: number; shorts: number };

/**
 * Plan- und Zuteilungsregeln. `usedByOthers` = Summe der Zuteilungen anderer, nicht archivierter Systeme.
 * Gibt Fehlermeldungen je Feld zurück (leer = gültig).
 */
export function validateAgainstPlan(input: SystemInput, plan: PlanKey, usedByOthers: Allocation, voiceKeys?: string[]) {
  const errors: Record<string, string> = {};
  const p = PLANS[plan];
  const s3 = step3Schema.safeParse(input);
  if (!s3.success) for (const i of s3.error.issues) errors[i.path.join(".") || "tone"] = i.message;
  const allowedVoices = voiceKeys ?? DEMO_VOICES.map((v) => v.key);
  if (!allowedVoices.includes(input.voiceKey)) errors.voiceKey = "Diese Stimme ist nicht verfügbar.";

  const freeLong = Math.max(0, p.longformPerPeriod - usedByOthers.longform);
  const freeShort = Math.max(0, p.shortsPerPeriod - usedByOthers.shorts);

  if (input.longformEnabled) {
    if (input.longformPerPeriod < 1) errors.longformPerPeriod = "Mindestens 1 Video pro Abrechnungszeitraum";
    if (input.longformPerPeriod > freeLong)
      errors.longformPerPeriod = `Im ${p.name}-Plan sind noch ${freeLong} Longform-Videos pro Zeitraum frei.`;
    if (input.longformMinutes > p.longformMaxMinutes)
      errors.longformMinutes = `Im ${p.name}-Plan höchstens ${p.longformMaxMinutes} Minuten pro Video.`;
  } else if (input.longformPerPeriod !== 0) {
    errors.longformPerPeriod = "Longform ist deaktiviert – Anzahl muss 0 sein.";
  }
  if (input.shortsEnabled) {
    if (input.shortsPerPeriod < 1) errors.shortsPerPeriod = "Mindestens 1 Short pro Abrechnungszeitraum";
    if (input.shortsPerPeriod > freeShort) errors.shortsPerPeriod = `Im ${p.name}-Plan sind noch ${freeShort} Shorts pro Zeitraum frei.`;
  } else if (input.shortsPerPeriod !== 0) {
    errors.shortsPerPeriod = "Shorts sind deaktiviert – Anzahl muss 0 sein.";
  }

  const longSlots = input.slots.filter((s) => s.format === "longform");
  const shortSlots = input.slots.filter((s) => s.format === "short");
  if (input.longformEnabled && longSlots.length === 0) errors.slots = "Bitte mindestens einen Video-Slot anlegen.";
  if (input.shortsEnabled && shortSlots.length === 0) errors.slotsShort = "Bitte mindestens einen Shorts-Slot anlegen.";
  if (!input.longformEnabled && longSlots.length > 0) errors.slots = "Longform ist deaktiviert – bitte Video-Slots entfernen.";
  if (!input.shortsEnabled && shortSlots.length > 0) errors.slotsShort = "Shorts sind deaktiviert – bitte Shorts-Slots entfernen.";
  const keys = new Set<string>();
  for (const s of input.slots) {
    const k = `${s.format}-${s.weekday}-${s.localTime}`;
    if (keys.has(k)) errors.slots = "Ein Slot ist doppelt eingetragen.";
    keys.add(k);
  }
  return errors;
}

export const EMPTY_SYSTEM_INPUT: SystemInput = {
  name: "",
  niche: "",
  topics: [],
  audience: "",
  language: "de",
  referenceChannels: ["", ""],
  tone: "spannend",
  style: "doku",
  voiceKey: "demo-ruhig",
  longformEnabled: true,
  shortsEnabled: true,
  shortPlatforms: ["youtube", "instagram", "tiktok"],
  longformPerPeriod: 8,
  longformMinutes: 7,
  shortsPerPeriod: 12,
  shortSeconds: 45,
  timezone: "Europe/Berlin",
  slots: [
    { format: "longform", weekday: 1, localTime: "18:00" },
    { format: "longform", weekday: 3, localTime: "18:00" },
    { format: "longform", weekday: 5, localTime: "18:00" },
    { format: "short", weekday: 2, localTime: "12:00" },
    { format: "short", weekday: 4, localTime: "12:00" },
    { format: "short", weekday: 6, localTime: "12:00" },
  ],
  reviewMode: "final_only",
};

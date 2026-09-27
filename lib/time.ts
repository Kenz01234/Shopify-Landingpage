import { DateTime, IANAZone } from "luxon";

/**
 * Zeitlogik für Uploadslots.
 * - Gespeichert wird immer UTC; angezeigt in der Zeitzone des Systems.
 * - Nicht existierende lokale Zeiten (Sommerzeit-Lücke) werden um die Länge der Lücke nach vorne
 *   verschoben (02:30 → 03:30), doppelte lokale Zeiten (Winterzeit-Überlappung) nehmen das
 *   frühere Auftreten. Das entspricht der „compatible“-Regel des TC39-Temporal-Standards.
 */

export type SlotAdjustment = null | "dst_gap" | "dst_overlap";

export type ResolvedSlot = {
  utc: Date;
  adjustment: SlotAdjustment;
};

export const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
export const WEEKDAYS_LONG_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;

export function isValidTimeZone(zone: string): boolean {
  return typeof zone === "string" && zone.length > 0 && IANAZone.isValidZone(zone);
}

export function parseLocalTime(t: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Löst ein lokales Datum + Uhrzeit in einer Zeitzone eindeutig in UTC auf. */
export function resolveLocal(
  date: { year: number; month: number; day: number },
  localTime: string,
  zone: string,
): ResolvedSlot {
  const t = parseLocalTime(localTime);
  if (!t) throw new Error(`Ungültige Uhrzeit: ${localTime}`);
  const wanted = { ...date, hour: t.hour, minute: t.minute };
  const guess = DateTime.fromObject(wanted, { zone });
  if (!guess.isValid) throw new Error(`Ungültiges Datum in ${zone}`);

  const matches = (d: DateTime) =>
    d.year === wanted.year && d.month === wanted.month && d.day === wanted.day && d.hour === wanted.hour && d.minute === wanted.minute;

  // Alle Kandidaten mit derselben Wanduhrzeit sammeln (max. zwei bei Überlappung).
  const candidates = [guess.minus({ hours: 1 }), guess, guess.plus({ hours: 1 })]
    .map((d) => d.setZone(zone))
    .filter(matches)
    .map((d) => d.toMillis());
  const unique = [...new Set(candidates)].sort((a, b) => a - b);

  if (unique.length === 0) {
    // Lücke: Luxon verschiebt bereits nach vorne (z. B. 02:30 → 03:30 MESZ).
    return { utc: guess.toUTC().toJSDate(), adjustment: "dst_gap" };
  }
  if (unique.length > 1) {
    return { utc: new Date(unique[0]), adjustment: "dst_overlap" };
  }
  return { utc: new Date(unique[0]), adjustment: null };
}

export type SlotRule = { id?: string; format: "longform" | "short"; weekday: number; localTime: string };

export type SlotOccurrence = {
  format: "longform" | "short";
  utc: Date;
  adjustment: SlotAdjustment;
  weekday: number;
  localTime: string;
};

/** Alle Slot-Termine im Intervall (from, to] – sortiert. */
export function occurrencesBetween(rules: SlotRule[], zone: string, from: Date, to: Date): SlotOccurrence[] {
  if (!rules.length) return [];
  const out: SlotOccurrence[] = [];
  let day = DateTime.fromJSDate(from, { zone }).startOf("day").minus({ days: 1 });
  const end = DateTime.fromJSDate(to, { zone }).endOf("day").plus({ days: 1 });
  let guard = 0;
  while (day <= end && guard++ < 800) {
    for (const r of rules) {
      if (r.weekday !== day.weekday) continue;
      const res = resolveLocal({ year: day.year, month: day.month, day: day.day }, r.localTime, zone);
      if (res.utc.getTime() > from.getTime() && res.utc.getTime() <= to.getTime()) {
        out.push({ format: r.format, utc: res.utc, adjustment: res.adjustment, weekday: r.weekday, localTime: r.localTime });
      }
    }
    day = day.plus({ days: 1 });
  }
  out.sort((a, b) => a.utc.getTime() - b.utc.getTime() || a.format.localeCompare(b.format));
  // Doppelte Zeitpunkte (z. B. zwei Regeln, die durch die Zeitumstellung zusammenfallen) entfernen
  return out.filter((o, i) => i === 0 || o.utc.getTime() !== out[i - 1].utc.getTime() || o.format !== out[i - 1].format);
}

/** Nächste freie Termine eines Formats nach `after`, unter Ausschluss belegter Zeitpunkte. */
export function nextFreeOccurrences(
  rules: SlotRule[],
  zone: string,
  format: "longform" | "short",
  after: Date,
  occupied: Set<number>,
  count = 1,
  horizonDays = 60,
): SlotOccurrence[] {
  const relevant = rules.filter((r) => r.format === format);
  const to = new Date(after.getTime() + horizonDays * 86400000);
  return occurrencesBetween(relevant, zone, after, to)
    .filter((o) => !occupied.has(o.utc.getTime()))
    .slice(0, count);
}

export function formatInZone(d: Date, zone: string, fmt = "ccc, d. LLL yyyy, HH:mm") {
  return DateTime.fromJSDate(d, { zone }).setLocale("de").toFormat(fmt);
}

export function formatDateTimeDe(d: Date | string | null | undefined, zone = "Europe/Berlin", fmt = "ccc, d. LLL, HH:mm") {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return DateTime.fromJSDate(date, { zone }).setLocale("de").toFormat(fmt);
}

export function zoneAbbrev(d: Date, zone: string) {
  return DateTime.fromJSDate(d, { zone }).setLocale("de").toFormat("ZZZZ");
}

/** Interpretiert „YYYY-MM-DDTHH:mm“ (datetime-local) in einer Zeitzone. */
export function parseLocalDateTimeInput(value: string, zone: string): ResolvedSlot {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!m) throw new Error("Ungültiges Datumsformat");
  return resolveLocal({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, m[4], zone);
}

export function toLocalInputValue(d: Date, zone: string) {
  return DateTime.fromJSDate(d, { zone }).toFormat("yyyy-LL-dd'T'HH:mm");
}

export const adjustmentText: Record<Exclude<SlotAdjustment, null>, string> = {
  dst_gap: "Diese Uhrzeit existiert wegen der Umstellung auf Sommerzeit nicht – der Termin wurde um eine Stunde nach hinten verschoben.",
  dst_overlap: "Diese Uhrzeit gibt es wegen der Umstellung auf Winterzeit zweimal – es gilt das erste Auftreten (Sommerzeit).",
};

export function addMonthsUtc(d: Date, months: number, zone = "Europe/Berlin") {
  return DateTime.fromJSDate(d, { zone }).plus({ months }).toUTC().toJSDate();
}

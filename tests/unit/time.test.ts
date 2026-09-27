import { describe, expect, it } from "vitest";
import { resolveLocal, occurrencesBetween, nextFreeOccurrences, parseLocalDateTimeInput, isValidTimeZone } from "@/lib/time";

describe("Zeitzonen & Sommerzeit", () => {
  it("verschiebt nicht existierende Zeiten (Sommerzeit-Lücke) nach vorne", () => {
    const r = resolveLocal({ year: 2026, month: 3, day: 29 }, "02:30", "Europe/Berlin");
    expect(r.adjustment).toBe("dst_gap");
    expect(r.utc.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
  it("nimmt bei doppelten Zeiten (Winterzeit) das erste Auftreten", () => {
    const r = resolveLocal({ year: 2026, month: 10, day: 25 }, "02:30", "Europe/Berlin");
    expect(r.adjustment).toBe("dst_overlap");
    expect(r.utc.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
  it("löst normale Zeiten ohne Anpassung auf (Sommer- und Winterzeit)", () => {
    expect(resolveLocal({ year: 2026, month: 7, day: 1 }, "18:00", "Europe/Berlin")).toEqual({ utc: new Date("2026-07-01T16:00:00Z"), adjustment: null });
    expect(resolveLocal({ year: 2026, month: 12, day: 1 }, "18:00", "Europe/Berlin")).toEqual({ utc: new Date("2026-12-01T17:00:00Z"), adjustment: null });
  });
  it("berechnet Slot-Termine über die Zeitumstellung hinweg korrekt", () => {
    const occ = occurrencesBetween([{ format: "longform", weekday: 7, localTime: "18:00" }], "Europe/Berlin", new Date("2026-10-17T00:00:00Z"), new Date("2026-11-02T00:00:00Z"));
    expect(occ.map((o) => o.utc.toISOString())).toEqual(["2026-10-18T16:00:00.000Z", "2026-10-25T17:00:00.000Z", "2026-11-01T17:00:00.000Z"]);
  });
  it("trennt Formate und überspringt belegte Termine", () => {
    const rules = [
      { format: "longform" as const, weekday: 1, localTime: "18:00" },
      { format: "short" as const, weekday: 1, localTime: "12:00" },
    ];
    const from = new Date("2026-09-27T00:00:00Z");
    const first = nextFreeOccurrences(rules, "Europe/Berlin", "longform", from, new Set(), 1)[0];
    expect(first.utc.toISOString()).toBe("2026-09-28T16:00:00.000Z");
    const second = nextFreeOccurrences(rules, "Europe/Berlin", "longform", from, new Set([first.utc.getTime()]), 1)[0];
    expect(second.utc.toISOString()).toBe("2026-10-05T16:00:00.000Z");
  });
  it("interpretiert datetime-local in der Systemzeitzone", () => {
    expect(parseLocalDateTimeInput("2026-10-01T09:15", "America/New_York").utc.toISOString()).toBe("2026-10-01T13:15:00.000Z");
  });
  it("validiert IANA-Zeitzonen", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

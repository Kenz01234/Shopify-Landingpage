/**
 * Vorläufige Pakete (Vorschläge, keine endgültigen Konditionen – siehe docs/ANNAHMEN.md).
 * Preise sind Monatspreise; die Steuerdarstellung ist noch offen.
 */
export type PlanKey = "starter" | "studio";

export type Plan = {
  key: PlanKey;
  name: string;
  priceEurMonthly: number;
  longformPerPeriod: number;
  longformMaxMinutes: number;
  shortsPerPeriod: number;
  tagline: string;
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    name: "Starter",
    priceEurMonthly: 60,
    longformPerPeriod: 15,
    longformMaxMinutes: 7,
    shortsPerPeriod: 30,
    tagline: "Für den Einstieg in einen regelmäßigen Kanal.",
  },
  studio: {
    key: "studio",
    name: "Studio",
    priceEurMonthly: 100,
    longformPerPeriod: 30,
    longformMaxMinutes: 10,
    shortsPerPeriod: 30,
    tagline: "Doppelte Anzahl längerer Videos für mehr Takt.",
  },
};

export const PLAN_ORDER: PlanKey[] = ["starter", "studio"];

/** Annahmen, die noch nicht final entschieden sind (konfigurierbar, dokumentiert). */
export const ASSUMPTIONS = {
  shortMaxSeconds: 60,
  shortMinSeconds: 15,
  maxRevisionsPerJob: 2,
  maxSystemsPerOrg: 5,
  maxReferenceChannels: 10,
  unusedQuotaCarriesOver: false,
} as const;

export function planLongformMinutes(p: PlanKey) {
  const plan = PLANS[p];
  return plan.longformPerPeriod * plan.longformMaxMinutes;
}

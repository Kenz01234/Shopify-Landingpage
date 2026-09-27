import type { Subscription } from "@/generated/prisma/client";
import { PLANS, type PlanKey } from "@/lib/plans";

/** Hat die Organisation aktuell Anspruch auf Produktion und Veröffentlichung? */
export function isEntitled(sub: Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined, now: Date): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  return now.getTime() < sub.currentPeriodEnd.getTime();
}

export function entitlementReason(sub: Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined, now: Date): string | null {
  if (!sub) return "Kein aktives Abo – bitte einen Plan wählen.";
  if (sub.status === "past_due") return "Die letzte Zahlung ist fehlgeschlagen. Neue Produktionen und Veröffentlichungen sind angehalten.";
  if (sub.status === "canceled") return "Das Abo ist beendet. Neue Produktionen und Veröffentlichungen sind angehalten.";
  if (sub.status === "incomplete") return "Das Abo ist noch nicht bestätigt.";
  if (now.getTime() >= sub.currentPeriodEnd.getTime()) return "Der Abrechnungszeitraum wird gerade verlängert.";
  return null;
}

export function planLimits(plan: PlanKey) {
  const p = PLANS[plan];
  return { longform: p.longformPerPeriod, short: p.shortsPerPeriod };
}

export const SUBSCRIPTION_STATUS_DE: Record<string, string> = {
  incomplete: "Unvollständig",
  active: "Aktiv",
  past_due: "Zahlung offen",
  canceled: "Beendet",
};

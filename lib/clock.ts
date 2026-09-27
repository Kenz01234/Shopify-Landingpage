import { isDemoMode } from "@/lib/env";

/**
 * „Jetzt“ aus Sicht einer Organisation. Im Demo-Modus kann die Zeit pro Organisation vorgespult
 * werden (Demo-Zeitsteuerung), damit fällige Veröffentlichungen nachvollziehbar getestet werden können.
 */
export function orgNow(org: { demoClockOffsetMinutes: number } | null | undefined, base = Date.now()): Date {
  const offset = isDemoMode() && org ? org.demoClockOffsetMinutes : 0;
  return new Date(base + offset * 60_000);
}

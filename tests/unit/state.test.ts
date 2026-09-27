import { describe, expect, it } from "vitest";
import { canTransition, TRANSITIONS, STATUS_META } from "@/lib/jobs/state";

describe("Zustandsautomat", () => {
  it("erlaubt den regulären Produktionsweg", () => {
    const path = ["queued", "researching", "scripting", "voiceover", "rendering", "quality_check", "awaiting_approval", "approved", "scheduled", "publishing", "published"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("verbietet Abkürzungen ohne Freigabe", () => {
    expect(canTransition("awaiting_approval", "scheduled")).toBe(false);
    expect(canTransition("awaiting_approval", "publishing")).toBe(false);
    expect(canTransition("rendering", "published")).toBe(false);
    expect(canTransition("quality_check", "approved")).toBe(false);
  });
  it("hat Endzustände ohne Ausgang", () => {
    expect(TRANSITIONS.published).toEqual([]);
    expect(TRANSITIONS.cancelled).toEqual([]);
    expect(TRANSITIONS.rejected).toEqual([]);
  });
  it("hat für jeden Status eine deutsche Bezeichnung", () => {
    for (const k of Object.keys(TRANSITIONS)) expect(STATUS_META[k as keyof typeof STATUS_META].label.length).toBeGreaterThan(2);
  });
});

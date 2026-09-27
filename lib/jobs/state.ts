import type { JobStatus } from "@/generated/prisma/enums";

/**
 * Zustandsautomat eines Produktionsauftrags.
 * Hinweis: Diese Datei ist client-sicher (nur Typen + Konstanten).
 */

export const PROCESSING_STATUSES: JobStatus[] = [
  "queued",
  "researching",
  "scripting",
  "voiceover",
  "rendering",
  "quality_check",
  "changes_requested",
  "retry_scheduled",
];

export const REVIEW_STATUSES: JobStatus[] = ["awaiting_topic_approval", "awaiting_script_approval", "awaiting_approval"];

/** Zustände vor der finalen Freigabe (für Slot-verpasst-Logik). */
export const PRE_APPROVAL_STATUSES: JobStatus[] = [
  "draft",
  ...PROCESSING_STATUSES,
  "awaiting_topic_approval",
  "awaiting_script_approval",
  "awaiting_approval",
];

export const TERMINAL_STATUSES: JobStatus[] = ["published", "rejected", "cancelled"];

export const CANCELLABLE_STATUSES: JobStatus[] = [
  ...PRE_APPROVAL_STATUSES,
  "approved",
  "scheduled",
  "held",
  "failed",
];

export const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["queued", "cancelled"],
  queued: ["researching", "scripting", "voiceover", "rendering", "quality_check", "retry_scheduled", "failed", "cancelled"],
  researching: ["awaiting_topic_approval", "scripting", "retry_scheduled", "failed", "cancelled"],
  awaiting_topic_approval: ["scripting", "researching", "rejected", "cancelled"],
  scripting: ["awaiting_script_approval", "voiceover", "retry_scheduled", "failed", "cancelled"],
  awaiting_script_approval: ["voiceover", "scripting", "rejected", "cancelled"],
  voiceover: ["rendering", "retry_scheduled", "failed", "cancelled"],
  rendering: ["quality_check", "retry_scheduled", "failed", "cancelled"],
  quality_check: ["awaiting_approval", "retry_scheduled", "failed", "cancelled"],
  awaiting_approval: ["approved", "changes_requested", "rejected", "cancelled"],
  changes_requested: ["scripting", "voiceover", "retry_scheduled", "failed", "cancelled"],
  approved: ["scheduled", "awaiting_approval", "cancelled"],
  scheduled: ["publishing", "held", "awaiting_approval", "changes_requested", "cancelled"],
  held: ["scheduled", "awaiting_approval", "changes_requested", "cancelled"],
  publishing: ["published", "reconciling", "failed", "held"],
  reconciling: ["published", "failed", "scheduled"],
  published: [],
  retry_scheduled: ["queued", "researching", "scripting", "voiceover", "rendering", "quality_check", "failed", "cancelled"],
  failed: ["queued", "cancelled"],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type StatusTone = "neutral" | "progress" | "review" | "ok" | "scheduled" | "warn" | "error" | "muted" | "demo";

export const STATUS_META: Record<JobStatus, { label: string; tone: StatusTone; hint: string }> = {
  draft: { label: "Entwurf", tone: "muted", hint: "Noch nicht gestartet." },
  queued: { label: "In Warteschlange", tone: "progress", hint: "Wartet auf den Produktions-Worker." },
  researching: { label: "Recherche läuft", tone: "progress", hint: "Themen, Fakten und Rohmaterial werden gesammelt." },
  awaiting_topic_approval: { label: "Thema bestätigen", tone: "review", hint: "Bitte das vorgeschlagene Thema bestätigen." },
  scripting: { label: "Skript entsteht", tone: "progress", hint: "Das Skript wird geschrieben." },
  awaiting_script_approval: { label: "Skript bestätigen", tone: "review", hint: "Bitte das Skript vor der Vertonung prüfen." },
  voiceover: { label: "KI-Stimme", tone: "progress", hint: "Das Skript wird vertont." },
  rendering: { label: "Video entsteht", tone: "progress", hint: "Schnitt, Musik und Untertitel." },
  quality_check: { label: "Automatische Prüfung", tone: "progress", hint: "Technische und inhaltliche Checks – ersetzt keine Freigabe." },
  awaiting_approval: { label: "Wartet auf Freigabe", tone: "review", hint: "Bitte prüfen und freigeben." },
  changes_requested: { label: "Wird überarbeitet", tone: "progress", hint: "Deine Änderungswünsche werden umgesetzt." },
  approved: { label: "Freigegeben", tone: "ok", hint: "Freigegeben, Termin wird gesetzt." },
  scheduled: { label: "Geplant", tone: "scheduled", hint: "Freigegeben und eingeplant." },
  held: { label: "Zurückgehalten", tone: "warn", hint: "Veröffentlichung pausiert – bitte Termin bestätigen." },
  publishing: { label: "Wird veröffentlicht", tone: "progress", hint: "Upload läuft." },
  reconciling: { label: "Upload wird geklärt", tone: "warn", hint: "Antwort des Upload-Dienstes war unklar – wird abgeglichen, nicht erneut hochgeladen." },
  published: { label: "Veröffentlicht", tone: "ok", hint: "Veröffentlicht." },
  retry_scheduled: { label: "Neuer Versuch geplant", tone: "warn", hint: "Technischer Fehler – automatischer neuer Versuch." },
  failed: { label: "Fehlgeschlagen", tone: "error", hint: "Produktion angehalten – bitte prüfen." },
  rejected: { label: "Verworfen", tone: "muted", hint: "Von dir verworfen." },
  cancelled: { label: "Abgebrochen", tone: "muted", hint: "Abgebrochen." },
};

export const PUBLICATION_META: Record<string, { label: string; tone: StatusTone }> = {
  scheduled: { label: "Geplant", tone: "scheduled" },
  held: { label: "Zurückgehalten", tone: "warn" },
  publishing: { label: "Wird veröffentlicht", tone: "progress" },
  reconciling: { label: "Wird abgeglichen", tone: "warn" },
  simulated: { label: "Demo-veröffentlicht", tone: "demo" },
  published: { label: "Veröffentlicht", tone: "ok" },
  failed: { label: "Fehlgeschlagen", tone: "error" },
  cancelled: { label: "Abgesagt", tone: "muted" },
};

export const PIPELINE: { status: JobStatus; label: string }[] = [
  { status: "queued", label: "Auftrag" },
  { status: "researching", label: "Recherche" },
  { status: "scripting", label: "Skript" },
  { status: "voiceover", label: "KI-Stimme" },
  { status: "rendering", label: "Video" },
  { status: "quality_check", label: "Prüfung" },
  { status: "awaiting_approval", label: "Freigabe" },
  { status: "scheduled", label: "Geplant" },
  { status: "published", label: "Online" },
];

/** Position eines Status in der Pipeline-Anzeige (für Fortschrittsbalken). */
export function pipelineIndex(status: JobStatus, retryStep?: JobStatus | null): number {
  const map: Partial<Record<JobStatus, number>> = {
    draft: 0,
    queued: 0,
    researching: 1,
    awaiting_topic_approval: 1,
    scripting: 2,
    awaiting_script_approval: 2,
    changes_requested: 2,
    voiceover: 3,
    rendering: 4,
    quality_check: 5,
    awaiting_approval: 6,
    approved: 7,
    scheduled: 7,
    held: 7,
    publishing: 8,
    reconciling: 8,
    published: 8,
  };
  if (status === "retry_scheduled" || status === "failed") return retryStep ? (map[retryStep] ?? 0) : 0;
  return map[status] ?? 0;
}

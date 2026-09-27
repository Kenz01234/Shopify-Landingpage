"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2, Pause, Play, Plus, Trash2, AlertTriangle, CalendarDays, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Toggle, RadioCard } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/misc";
import { DemoTag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import {
  EMPTY_SYSTEM_INPUT,
  LANGUAGES,
  REVIEW_MODES,
  STYLES,
  TONES,
  step1Schema,
  step2Schema,
  step3Schema,
  step5Schema,
  validateAgainstPlan,
  type SystemInput,
  type Allocation,
} from "@/lib/validation/system";
import { parseYouTubeChannel } from "@/lib/youtube-url";
import { DEMO_VOICES } from "@/lib/voices";
import { ASSUMPTIONS, PLANS, type PlanKey } from "@/lib/plans";
import { WEEKDAYS_DE, WEEKDAYS_LONG_DE, occurrencesBetween, formatInZone, resolveLocal, adjustmentText, isValidTimeZone } from "@/lib/time";

const STEPS = [
  { key: 1, label: "Grundlagen" },
  { key: 2, label: "Vorbilder" },
  { key: 3, label: "Stil & Stimme" },
  { key: 4, label: "Mengen" },
  { key: 5, label: "Uploadplan" },
  { key: 6, label: "Freigabe" },
  { key: 7, label: "Überblick" },
];

const NICHE_SUGGESTIONS = ["Weltall & Wissen", "Geschichte & Antike", "Tiefsee & Meer", "Natur & Tiere", "Technik erklärt", "Psychologie im Alltag"];
const TIMEZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Madrid", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo", "UTC"];

const FIELD_STEP: Record<string, number> = {
  name: 1, niche: 1, topics: 1, audience: 1, language: 1,
  referenceChannels: 2,
  tone: 3, style: 3, voiceKey: 3, longformEnabled: 3, shortsEnabled: 3,
  longformPerPeriod: 4, longformMinutes: 4, shortsPerPeriod: 4, shortSeconds: 4,
  timezone: 5, slots: 5, slotsShort: 5,
  reviewMode: 6,
};

export type WizardProps = {
  mode: "create" | "edit";
  systemId?: string;
  initial?: SystemInput;
  draft?: { step: number; data: Partial<SystemInput>; updatedAt: string } | null;
  plan: PlanKey;
  usedByOthers: Allocation;
};

export function SystemWizard({ mode, systemId, initial, draft, plan, usedByOthers }: WizardProps) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<number>(mode === "create" && draft ? Math.min(draft.step, 7) : 1);
  const [data, setData] = useState<SystemInput>(() => ({ ...EMPTY_SYSTEM_INPUT, ...(initial ?? {}), ...((mode === "create" && draft?.data) || {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState<"idle" | "saving" | "saved" | "error">(draft ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(draft?.updatedAt ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [dir, setDir] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const p = PLANS[plan];

  // Übergabe aus dem Konfigurator der Startseite (nur beim Anlegen, nur ohne Server-Entwurf)
  useEffect(() => {
    if (mode !== "create" || draft) return;
    try {
      const raw = sessionStorage.getItem("qa-configurator");
      if (!raw) return;
      const cfg = JSON.parse(raw) as Partial<SystemInput>;
      setData((d) => ({ ...d, ...cfg }));
      sessionStorage.removeItem("qa-configurator");
      toast({ tone: "info", title: "Deine Auswahl von der Startseite wurde übernommen", text: "Du kannst alles in Ruhe anpassen." });
    } catch {
      /* Speicher nicht verfügbar */
    }
  }, [mode, draft, toast]);

  const set = <K extends keyof SystemInput>(key: K, value: SystemInput[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      const { [key as string]: _drop, ...rest } = e;
      void _drop;
      return rest;
    });
  };

  const validateStep = (s: number): Record<string, string> => {
    const out: Record<string, string> = {};
    const collect = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => {
      if (!r.success) for (const i of r.error!.issues) out[i.path.map(String).join(".") || "form"] ??= i.message;
    };
    if (s === 1) collect(step1Schema.safeParse(data));
    if (s === 2) {
      const list = data.referenceChannels.filter((r) => r.trim() !== "");
      collect(step2Schema.safeParse({ referenceChannels: list }));
    }
    if (s === 3) collect(step3Schema.safeParse(data));
    if (s === 4 || s === 5) {
      const planErrors = validateAgainstPlan({ ...data, referenceChannels: data.referenceChannels.filter(Boolean) }, plan, usedByOthers);
      for (const [k, v] of Object.entries(planErrors)) if (FIELD_STEP[k] === s) out[k] = v;
      if (s === 4 && (data.shortSeconds < ASSUMPTIONS.shortMinSeconds || data.shortSeconds > ASSUMPTIONS.shortMaxSeconds)) {
        out.shortSeconds = `Zwischen ${ASSUMPTIONS.shortMinSeconds} und ${ASSUMPTIONS.shortMaxSeconds} Sekunden.`;
      }
      if (s === 5) collect(step5Schema.safeParse(data));
    }
    return out;
  };

  const saveDraft = async (nextStep: number) => {
    if (mode !== "create") return;
    setSavingDraft("saving");
    try {
      const r = await apiFetch<{ updatedAt: string }>("/api/wizard-draft", { method: "PUT", body: { step: nextStep, data } });
      setSavedAt(r.updatedAt);
      setSavingDraft("saved");
    } catch {
      setSavingDraft("error");
    }
  };

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
    setServerError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    const to = Math.min(7, step + 1);
    if (step === 2) set("referenceChannels", data.referenceChannels.filter((r) => r.trim() !== ""));
    saveDraft(to);
    go(to);
  };

  const submit = async () => {
    for (let s = 1; s <= 6; s++) {
      const e = validateStep(s);
      if (Object.keys(e).length) {
        setErrors(e);
        go(s);
        return;
      }
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = { ...data, referenceChannels: data.referenceChannels.filter((r) => r.trim() !== "") };
      if (mode === "create") {
        const r = await apiFetch<{ id: string }>("/api/systems", { body: payload });
        toast({ tone: "ok", title: "System gespeichert und aktiviert", text: "Der Scheduler plant jetzt die ersten Aufträge für deine Slots." });
        router.push(`/app/systeme/${r.id}?neu=1`);
      } else {
        await apiFetch(`/api/systems/${systemId}`, { method: "PATCH", body: payload });
        toast({ tone: "ok", title: "Änderungen gespeichert", text: "Neue Aufträge nutzen ab jetzt die neue Konfiguration." });
        router.push(`/app/systeme/${systemId}`);
      }
      router.refresh();
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ApiError && e.fields) {
        setErrors(e.fields);
        const first = Object.keys(e.fields).map((k) => FIELD_STEP[k.split(".")[0]] ?? 7).sort()[0];
        if (first && first !== step) go(first);
      }
      setServerError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d: number) => ({ opacity: 0, x: d * 28, filter: "blur(4px)" }),
        center: { opacity: 1, x: 0, filter: "blur(0px)" },
        exit: (d: number) => ({ opacity: 0, x: d * -28, filter: "blur(4px)" }),
      };

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
      {/* Schrittanzeige */}
      <nav aria-label="Schritte" className="lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <p className="text-sm font-semibold">
            Schritt {step} von 7 · <span className="text-ink-3">{STEPS[step - 1].label}</span>
          </p>
          <DraftState state={savingDraft} savedAt={savedAt} mode={mode} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3 lg:hidden" aria-hidden>
          <motion.div className="h-full rounded-full bg-coral" animate={{ width: `${(step / 7) * 100}%` }} />
        </div>
        <ol className="hidden space-y-1 lg:block">
          {STEPS.map((s) => {
            const done = s.key < step;
            const current = s.key === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => (s.key < step ? go(s.key) : undefined)}
                  disabled={s.key > step}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    current ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-line" : done ? "text-ink-2 hover:bg-surface-3" : "text-ink-3",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                      done ? "border-coral bg-coral text-white" : current ? "border-coral text-coral" : "border-line-strong text-ink-3",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : s.key}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 hidden lg:block">
          <DraftState state={savingDraft} savedAt={savedAt} mode={mode} />
        </div>
      </nav>

      <div className="min-w-0">
        <div className="card overflow-hidden">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="p-5 sm:p-8"
            >
              <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold tracking-[-0.03em] outline-none">
                {STEP_TITLES[step]}
              </h2>
              <p className="mt-1 text-ink-3">{STEP_INTROS[step]}</p>
              <div className="mt-6">
                {step === 1 && <Step1 data={data} set={set} errors={errors} />}
                {step === 2 && <Step2 data={data} set={set} errors={errors} />}
                {step === 3 && <Step3 data={data} set={set} errors={errors} />}
                {step === 4 && <Step4 data={data} set={set} errors={errors} plan={plan} usedByOthers={usedByOthers} />}
                {step === 5 && <Step5 data={data} set={set} errors={errors} />}
                {step === 6 && <Step6 data={data} set={set} />}
                {step === 7 && <Step7 data={data} plan={plan} onEdit={go} />}
              </div>
              {serverError && (
                <InlineAlert tone="error" className="mt-6">
                  {serverError}
                </InlineAlert>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-4 sm:px-8">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 1 || submitting}>
              <ArrowLeft className="size-4" aria-hidden /> Zurück
            </Button>
            {step < 7 ? (
              <Button onClick={next}>
                Weiter <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} shine={!submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                {mode === "create" ? "Speichern & Loop aktivieren" : "Änderungen speichern"}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Plan: {p.name} – {p.longformPerPeriod} Videos à max. {p.longformMaxMinutes} Min. und {p.shortsPerPeriod} Shorts pro Abrechnungszeitraum.
        </p>
      </div>
    </div>
  );
}

const STEP_TITLES: Record<number, string> = {
  1: "Worum geht es in deinem Kanal?",
  2: "Welche Kanäle inspirieren dich?",
  3: "Wie soll es klingen und aussehen?",
  4: "Wie viel soll produziert werden?",
  5: "Wann wird veröffentlicht?",
  6: "Wann möchtest du prüfen?",
  7: "Alles im Blick – bereit?",
};
const STEP_INTROS: Record<number, string> = {
  1: "Name, Nische und Zielgruppe bestimmen die Themen, die Quest vorschlägt.",
  2: "Referenzkanäle liefern Stil-Signale. Inhalte werden nicht kopiert – und im Demo-Modus wird nichts abgerufen.",
  3: "Tonalität, Stil und die KI-Stimme, die deine Skripte spricht. Du selbst sprichst nichts ein.",
  4: "Innerhalb deines Plans legst du fest, wie viele Videos und Shorts dieses System pro Abrechnungszeitraum erhält.",
  5: "Video- und Shorts-Termine getrennt festlegen. Gespeichert wird in UTC, angezeigt in deiner Zeitzone.",
  6: "Die finale Freigabe ist immer Pflicht. Optional prüfst du schon Thema oder Skript vor der Produktion.",
  7: "Prüfe die Zusammenfassung. Nach dem Speichern plant Quest die ersten Aufträge für deine nächsten Slots.",
};

type StepProps = { data: SystemInput; set: <K extends keyof SystemInput>(k: K, v: SystemInput[K]) => void; errors: Record<string, string> };

function DraftState({ state, savedAt, mode }: { state: string; savedAt: string | null; mode: string }) {
  if (mode !== "create") return <p className="text-xs text-ink-3">Bearbeitung eines bestehenden Systems</p>;
  return (
    <p className="text-xs text-ink-3" aria-live="polite">
      {state === "saving"
        ? "Zwischenstand wird gespeichert …"
        : state === "error"
          ? "Zwischenstand konnte nicht gespeichert werden."
          : savedAt
            ? `Zwischenstand gespeichert · ${new Date(savedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
            : "Zwischenstand wird bei „Weiter“ gespeichert."}
    </p>
  );
}

function Step1({ data, set, errors }: StepProps) {
  const [topic, setTopic] = useState("");
  const addTopic = () => {
    const t = topic.trim();
    if (t.length < 2 || data.topics.includes(t) || data.topics.length >= 8) return;
    set("topics", [...data.topics, t]);
    setTopic("");
  };
  return (
    <div className="grid gap-5">
      <Field label="Name des Systems" htmlFor="name" error={errors.name} hint="Nur für dich sichtbar, z. B. „Kosmos kompakt“.">
        <Input id="name" value={data.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} maxLength={60} />
      </Field>
      <Field label="Nische" htmlFor="niche" error={errors.niche}>
        <Input id="niche" value={data.niche} onChange={(e) => set("niche", e.target.value)} invalid={!!errors.niche} maxLength={80} placeholder="z. B. Weltall & Wissen" />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {NICHE_SUGGESTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set("niche", n)}
              className={cn("rounded-full border px-3 py-1 text-sm transition", data.niche === n ? "border-coral/60 bg-coral-soft text-coral-ink" : "border-line text-ink-2 hover:border-line-strong")}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Themenschwerpunkte" htmlFor="topic" optional hint="Bis zu 8 Stichworte, mit Enter hinzufügen." error={errors.topics}>
        <div className="flex gap-2">
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic();
              }
            }}
            maxLength={40}
          />
          <Button variant="secondary" onClick={addTopic} aria-label="Thema hinzufügen">
            <Plus className="size-4" />
          </Button>
        </div>
        {data.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {data.topics.map((t) => (
              <li key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-1 pl-3 pr-1 text-sm">
                {t}
                <button type="button" onClick={() => set("topics", data.topics.filter((x) => x !== t))} className="grid size-6 place-items-center rounded-full hover:bg-line" aria-label={`${t} entfernen`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
      <Field label="Zielgruppe" htmlFor="audience" error={errors.audience}>
        <Textarea id="audience" rows={2} value={data.audience} onChange={(e) => set("audience", e.target.value)} invalid={!!errors.audience} maxLength={160} placeholder="Wer soll zuschauen – und was erwarten diese Menschen?" />
      </Field>
      <Field label="Sprache" htmlFor="language" error={errors.language}>
        <Select id="language" value={data.language} onChange={(e) => set("language", e.target.value as SystemInput["language"])}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function Step2({ data, set, errors }: StepProps) {
  const list = data.referenceChannels.length ? data.referenceChannels : [""];
  const update = (i: number, v: string) => set("referenceChannels", list.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {list.map((raw, i) => {
          const parsed = raw.trim() ? parseYouTubeChannel(raw) : null;
          const err = errors[`referenceChannels.${i}`];
          return (
            <li key={i}>
              <label htmlFor={`ref-${i}`} className="mb-1.5 block text-sm font-semibold">
                Referenzkanal {i + 1}
              </label>
              <div className="flex gap-2">
                <Input
                  id={`ref-${i}`}
                  value={raw}
                  onChange={(e) => update(i, e.target.value)}
                  placeholder="@kanalname oder https://www.youtube.com/@kanalname"
                  invalid={!!err || (parsed !== null && !parsed.ok)}
                  aria-describedby={`ref-${i}-status`}
                />
                <Button variant="secondary" onClick={() => set("referenceChannels", list.filter((_, j) => j !== i))} aria-label={`Referenzkanal ${i + 1} entfernen`} disabled={list.length === 1 && !raw}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p id={`ref-${i}-status`} className="mt-1 text-[0.82rem]">
                {err ? (
                  <span className="font-medium text-coral-ink">{err}</span>
                ) : parsed?.ok ? (
                  <span className="text-ok-ink">
                    ✓ Erkannt als {parsed.value.kind === "handle" ? "Handle" : parsed.value.kind === "channel_id" ? "Kanal-ID" : "Kanalname"}: {parsed.value.url}
                  </span>
                ) : parsed && !parsed.ok ? (
                  <span className="font-medium text-coral-ink">{parsed.error}</span>
                ) : (
                  <span className="text-ink-3">Akzeptiert: @handle, /channel/UC…, /c/Name, /user/Name</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      {errors.referenceChannels && <p className="text-sm font-medium text-coral-ink">{errors.referenceChannels}</p>}
      <Button variant="secondary" onClick={() => set("referenceChannels", [...list, ""])} disabled={list.length >= ASSUMPTIONS.maxReferenceChannels}>
        <Plus className="size-4" aria-hidden /> Weiteren Kanal hinzufügen
      </Button>
      <InlineAlert tone="info">
        Referenzkanäle sind Inspiration, keine Erlaubnis zum Kopieren. Quest nutzt sie als Signal für Themenwahl, Länge und Ton – eigene Skripte statt Übernahmen.
      </InlineAlert>
    </div>
  );
}

function Step3({ data, set, errors }: StepProps) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = async (key: string) => {
    if (playing === key) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(`/api/voices/${key}`);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setMissing((m) => ({ ...m, [key]: true }));
      setPlaying(null);
    };
    try {
      await a.play();
      setPlaying(key);
    } catch {
      setMissing((m) => ({ ...m, [key]: true }));
    }
  };
  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Tonalität</legend>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <ChipRadio key={t.value} name="tone" value={t.value} checked={data.tone === t.value} onChange={(v) => set("tone", v)} label={t.label} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Stil</legend>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((t) => (
            <ChipRadio key={t.value} name="style" value={t.value} checked={data.style === t.value} onChange={(v) => set("style", v)} label={t.label} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
          KI-Stimme <DemoTag>Demo-Stimmen</DemoTag>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO_VOICES.map((v) => (
            <div key={v.key} className={cn("rounded-2xl border p-3.5 transition", data.voiceKey === v.key ? "border-coral/60 bg-coral-soft/50 ring-1 ring-coral/30" : "border-line")}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="radio" name="voice" checked={data.voiceKey === v.key} onChange={() => set("voiceKey", v.key)} className="mt-1 size-4 accent-[var(--coral-strong)]" />
                <span>
                  <span className="block text-sm font-semibold">{v.label}</span>
                  <span className="block text-xs text-ink-3">{v.description}</span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => toggle(v.key)}
                disabled={missing[v.key]}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-60"
              >
                {playing === v.key ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {missing[v.key] ? "Keine Hörprobe vorhanden" : playing === v.key ? "Stopp" : "Hörprobe"}
              </button>
            </div>
          ))}
        </div>
        {errors.voiceKey && <p className="mt-1 text-sm font-medium text-coral-ink">{errors.voiceKey}</p>}
        <p className="mt-2 text-xs text-ink-3">
          Lokale Beispielstimmen (Piper, CC0-Datensatz) – keine ElevenLabs-Stimmen. Im Live-Betrieb wählst du aus der konfigurierten ElevenLabs-Auswahl.
        </p>
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Formate</legend>
        <Toggle checked={data.longformEnabled} onChange={(v) => { set("longformEnabled", v); if (!v) set("longformPerPeriod", 0); }} label="Longform-Videos (16:9)" description="Ausführliche Videos für deinen Kanal." />
        <Toggle checked={data.shortsEnabled} onChange={(v) => { set("shortsEnabled", v); if (!v) set("shortsPerPeriod", 0); }} label="Shorts (9:16)" description="Kurze Hochkant-Clips aus deinen Themen." />
        {errors.longformEnabled && <p className="text-sm font-medium text-coral-ink">{errors.longformEnabled}</p>}
      </fieldset>
    </div>
  );
}

function ChipRadio({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: (v: string) => void; label: string }) {
  return (
    <label className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-coral/40", checked ? "border-coral/60 bg-coral-soft font-semibold text-coral-ink" : "border-line text-ink-2 hover:border-line-strong")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {label}
    </label>
  );
}

function NumberStepper({ id, value, onChange, min, max, suffix, invalid }: { id: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; invalid?: boolean }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface text-lg disabled:opacity-40" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Verringern">
        −
      </button>
      <div className="relative w-28">
        <Input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))} className="text-center tabular-nums" invalid={invalid} />
      </div>
      <button type="button" className="grid size-11 place-items-center rounded-xl border border-line-strong bg-surface text-lg disabled:opacity-40" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Erhöhen">
        +
      </button>
      {suffix && <span className="text-sm text-ink-3">{suffix}</span>}
    </div>
  );
}

function Step4({ data, set, errors, plan, usedByOthers }: StepProps & { plan: PlanKey; usedByOthers: Allocation }) {
  const p = PLANS[plan];
  const freeLong = Math.max(0, p.longformPerPeriod - usedByOthers.longform);
  const freeShort = Math.max(0, p.shortsPerPeriod - usedByOthers.shorts);
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-ink-3">Frei für dieses System</span>
          <strong className="text-lg">{freeLong}</strong> Videos · <strong className="text-lg">{freeShort}</strong> Shorts
        </p>
        <p className="text-ink-3">
          Andere Systeme nutzen bereits {usedByOthers.longform} Videos und {usedByOthers.shorts} Shorts deines {p.name}-Plans. Unbegrenzte Produktion gibt es nicht.
        </p>
      </div>
      {data.longformEnabled && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Videos pro Abrechnungszeitraum" htmlFor="lf" error={errors.longformPerPeriod} hint={`≈ ${Math.round((data.longformPerPeriod / 4.3) * 10) / 10} pro Woche`}>
            <NumberStepper id="lf" value={data.longformPerPeriod} onChange={(v) => set("longformPerPeriod", v)} min={0} max={Math.max(freeLong, 0)} invalid={!!errors.longformPerPeriod} />
          </Field>
          <Field label="Länge pro Video" htmlFor="lm" error={errors.longformMinutes} hint={`Im ${p.name}-Plan bis ${p.longformMaxMinutes} Minuten.`}>
            <NumberStepper id="lm" value={data.longformMinutes} onChange={(v) => set("longformMinutes", v)} min={1} max={p.longformMaxMinutes} suffix="Min." invalid={!!errors.longformMinutes} />
          </Field>
        </div>
      )}
      {data.shortsEnabled && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Shorts pro Abrechnungszeitraum" htmlFor="sf" error={errors.shortsPerPeriod} hint={`≈ ${Math.round((data.shortsPerPeriod / 4.3) * 10) / 10} pro Woche`}>
            <NumberStepper id="sf" value={data.shortsPerPeriod} onChange={(v) => set("shortsPerPeriod", v)} min={0} max={Math.max(freeShort, 0)} invalid={!!errors.shortsPerPeriod} />
          </Field>
          <Field label="Länge pro Short" htmlFor="ss" error={errors.shortSeconds} hint={`${ASSUMPTIONS.shortMinSeconds}–${ASSUMPTIONS.shortMaxSeconds} Sekunden (vorläufige Annahme).`}>
            <NumberStepper id="ss" value={data.shortSeconds} onChange={(v) => set("shortSeconds", v)} min={ASSUMPTIONS.shortMinSeconds} max={ASSUMPTIONS.shortMaxSeconds} suffix="Sek." invalid={!!errors.shortSeconds} />
          </Field>
        </div>
      )}
    </div>
  );
}

function dstWarnings(slots: SystemInput["slots"], zone: string) {
  if (!isValidTimeZone(zone)) return [];
  const out = new Set<string>();
  const start = new Date();
  for (const s of slots) {
    // Prüft ein Jahr im Voraus auf Lücken und Doppelungen
    for (let d = 0; d < 370; d++) {
      const date = new Date(start.getTime() + d * 86400000);
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
      if (wd !== s.weekday) continue;
      try {
        const r = resolveLocal({ year: +get("year"), month: +get("month"), day: +get("day") }, s.localTime, zone);
        if (r.adjustment) {
          out.add(`${WEEKDAYS_LONG_DE[s.weekday - 1]}, ${s.localTime}: ${adjustmentText[r.adjustment]}`);
          break;
        }
      } catch {
        /* ungültig */
      }
    }
  }
  return [...out];
}

function SlotEditor({ format, data, set, error }: { format: "longform" | "short"; data: SystemInput; set: StepProps["set"]; error?: string }) {
  const slots = data.slots.filter((s) => s.format === format);
  const others = data.slots.filter((s) => s.format !== format);
  const setSlots = (list: SystemInput["slots"]) => set("slots", [...others, ...list]);
  const presets =
    format === "longform"
      ? [
          { label: "Mo · Mi · Fr 18:00", days: [1, 3, 5], time: "18:00" },
          { label: "Di · Do 17:00", days: [2, 4], time: "17:00" },
          { label: "Sa 10:00", days: [6], time: "10:00" },
        ]
      : [
          { label: "Täglich 12:00", days: [1, 2, 3, 4, 5, 6, 7], time: "12:00" },
          { label: "Di · Do · Sa 12:00", days: [2, 4, 6], time: "12:00" },
          { label: "Werktags 08:00", days: [1, 2, 3, 4, 5], time: "08:00" },
        ];
  return (
    <fieldset className="rounded-2xl border border-line p-4">
      <legend className="px-1 text-sm font-semibold">{format === "longform" ? "Video-Slots (Longform)" : "Shorts-Slots"}</legend>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((pr) => (
          <button key={pr.label} type="button" onClick={() => setSlots(pr.days.map((d) => ({ format, weekday: d, localTime: pr.time })))} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-coral/50 hover:text-coral-ink">
            {pr.label}
          </button>
        ))}
      </div>
      {slots.length === 0 && <p className="mb-2 text-sm text-ink-3">Noch keine Slots.</p>}
      <ul className="space-y-2">
        {slots.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${format}-d-${i}`}>Wochentag</label>
            <Select id={`${format}-d-${i}`} value={s.weekday} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))} className="w-36">
              {WEEKDAYS_LONG_DE.map((w, k) => (
                <option key={w} value={k + 1}>
                  {w}
                </option>
              ))}
            </Select>
            <label className="sr-only" htmlFor={`${format}-t-${i}`}>Uhrzeit</label>
            <Input id={`${format}-t-${i}`} type="time" value={s.localTime} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, localTime: e.target.value } : x)))} className="w-32" />
            <Button variant="ghost" size="sm" onClick={() => setSlots(slots.filter((_, j) => j !== i))} aria-label="Slot entfernen">
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSlots([...slots, { format, weekday: 1, localTime: format === "longform" ? "18:00" : "12:00" }])}>
        <Plus className="size-4" aria-hidden /> Slot hinzufügen
      </Button>
      {error && <p className="mt-2 text-sm font-medium text-coral-ink">{error}</p>}
    </fieldset>
  );
}

function Step5({ data, set, errors }: StepProps) {
  const warnings = useMemo(() => dstWarnings(data.slots, data.timezone), [data.slots, data.timezone]);
  const known = TIMEZONES.includes(data.timezone);
  return (
    <div className="grid gap-5">
      <Field label="Zeitzone" htmlFor="tz" error={errors.timezone} hint="Standard: Europe/Berlin. Sommer- und Winterzeit werden automatisch berücksichtigt.">
        <div className="flex flex-wrap gap-2">
          <Select id="tz" value={known ? data.timezone : "__custom"} onChange={(e) => set("timezone", e.target.value === "__custom" ? "" : e.target.value)} className="max-w-xs">
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom">Andere (IANA-Name) …</option>
          </Select>
          {!known && <Input aria-label="IANA-Zeitzone" value={data.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="z. B. America/Chicago" className="max-w-xs" invalid={!!errors.timezone} />}
        </div>
      </Field>
      {data.longformEnabled && <SlotEditor format="longform" data={data} set={set} error={errors.slots} />}
      {data.shortsEnabled && <SlotEditor format="short" data={data} set={set} error={errors.slotsShort} />}
      {warnings.length > 0 && (
        <InlineAlert tone="warn" title="Hinweis zur Zeitumstellung">
          <ul className="list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </InlineAlert>
      )}
    </div>
  );
}

function Step6({ data, set }: Omit<StepProps, "errors">) {
  return (
    <div className="grid gap-3">
      {REVIEW_MODES.map((m) => (
        <RadioCard key={m.value} name="review" value={m.value} checked={data.reviewMode === m.value} onChange={(v) => set("reviewMode", v as SystemInput["reviewMode"])} title={m.label} text={m.text} />
      ))}
      <InlineAlert tone="info" title="Immer gilt:">
        Keine Veröffentlichung ohne deine ausdrückliche Freigabe der aktuellen Version. Die automatische Prüfung ersetzt diese Freigabe nicht. Änderst du nach der Freigabe etwas, musst du erneut freigeben.
      </InlineAlert>
    </div>
  );
}

function Step7({ data, plan, onEdit }: { data: SystemInput; plan: PlanKey; onEdit: (s: number) => void }) {
  const now = new Date();
  const valid = isValidTimeZone(data.timezone);
  const upcoming = valid ? occurrencesBetween(data.slots, data.timezone, now, new Date(now.getTime() + 21 * 86400000)).slice(0, 4) : [];
  const voice = DEMO_VOICES.find((v) => v.key === data.voiceKey);
  const rows: { step: number; title: string; body: React.ReactNode }[] = [
    { step: 1, title: "Grundlagen", body: <>{data.name} · {data.niche} · {LANGUAGES.find((l) => l.value === data.language)?.label}<br /><span className="text-ink-3">{data.audience}</span></> },
    { step: 2, title: "Vorbilder", body: data.referenceChannels.filter(Boolean).map((r) => { const p = parseYouTubeChannel(r); return p.ok ? p.value.identifier : r; }).join(" · ") },
    { step: 3, title: "Stil & Stimme", body: <>{TONES.find((t) => t.value === data.tone)?.label} · {STYLES.find((s) => s.value === data.style)?.label} · {voice?.label}</> },
    {
      step: 4,
      title: "Mengen",
      body: (
        <>
          {data.longformEnabled ? `${data.longformPerPeriod} Videos à ${data.longformMinutes} Min.` : "Keine Videos"} · {data.shortsEnabled ? `${data.shortsPerPeriod} Shorts à ${data.shortSeconds} Sek.` : "Keine Shorts"}
          <span className="text-ink-3"> (Plan {PLANS[plan].name})</span>
        </>
      ),
    },
    {
      step: 5,
      title: "Uploadplan",
      body: (
        <>
          {(["longform", "short"] as const).map((f) => {
            const s = data.slots.filter((x) => x.format === f);
            if (!s.length) return null;
            return (
              <span key={f} className="block">
                {f === "longform" ? "Videos" : "Shorts"}: {s.map((x) => `${WEEKDAYS_DE[x.weekday - 1]} ${x.localTime}`).join(", ")}
              </span>
            );
          })}
          <span className="text-ink-3">{data.timezone}</span>
        </>
      ),
    },
    { step: 6, title: "Freigabe", body: REVIEW_MODES.find((m) => m.value === data.reviewMode)?.label },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <dl className="divide-y divide-line rounded-2xl border border-line">
        {rows.map((r) => (
          <div key={r.step} className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-sm font-semibold">{r.title}</dt>
            <dd className="min-w-0 flex-1 text-sm text-ink-2">{r.body}</dd>
            <button type="button" onClick={() => onEdit(r.step)} className="shrink-0 text-sm font-medium text-coral-ink hover:underline">
              Ändern
            </button>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-coral" aria-hidden /> Nächste gültige Slots
        </p>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Keine Slots in den nächsten drei Wochen.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {upcoming.map((o) => (
              <li key={o.utc.toISOString() + o.format} className="flex items-start justify-between gap-2">
                <span>
                  {formatInZone(o.utc, data.timezone, "ccc, d. LLL, HH:mm")}
                  {o.adjustment && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-warn">
                      <AlertTriangle className="size-3" aria-hidden /> Zeitumstellung
                    </span>
                  )}
                </span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold", o.format === "short" ? "bg-coral-soft text-coral-ink" : "bg-ink text-bg")}>{o.format === "short" ? "Short" : "Video"}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 flex gap-1.5 text-xs text-ink-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Nach dem Speichern legt der Scheduler Aufträge für die Slots der nächsten Tage an – innerhalb deiner Kontingente.
        </p>
      </div>
    </div>
  );
}

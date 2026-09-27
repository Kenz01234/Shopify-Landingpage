"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleAlert,
  Download,
  FileAudio,
  Film,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
  XCircle,
  CalendarClock,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/misc";
import { Badge, DemoTag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PublicationBadge } from "@/components/app/bits";
import { apiFetch, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { RIGHTS_LABEL, type AutoCheckResult, type CheckStatus } from "@/lib/autocheck";
import { formatInZone, parseLocalDateTimeInput, toLocalInputValue, adjustmentText, type SlotAdjustment } from "@/lib/time";
import type { SourceNote } from "@/providers/types";
import { HELD_REASON_DE_CLIENT } from "@/components/app/review/held-reasons";

type Job = {
  id: string;
  status: string;
  format: "longform" | "short";
  revisionCount: number;
  maxRevisions: number;
  slotMissedAt: string | null;
  suggestedSlotAt: string | null;
  timezone: string;
  systemName: string;
  systemPaused: boolean;
};
type Version = {
  id: string;
  number: number;
  stage: "topic" | "script" | "final";
  title: string;
  description: string;
  script: string;
  thumbnailText: string;
  tags: string[];
  requiresRerender: boolean;
  sources: SourceNote[];
  autoCheck: AutoCheckResult | null;
  durationSec: number | null;
};
type Asset = {
  id: string;
  kind: "video" | "short" | "audio" | "thumbnail";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  rightsStatus: string;
  sourceLabel: string | null;
  license: string | null;
  editNote: string | null;
};
type Slot = { at: string; label: string; adjustment: SlotAdjustment; adjustmentText: string | null; isTarget: boolean };

export function ReviewEditor(props: {
  job: Job;
  version: Version;
  assets: Asset[];
  versions: { id: string; number: number; stage: string; createdByType: string; changeNote: string | null; createdAt: string; title: string; current: boolean }[];
  approvals: { id: string; decision: string; stage: string; versionNumber: number; comment: string | null; createdAt: string; revokedAt: string | null; revokedReason: string | null; scheduledFor: string | null }[];
  publication: { id: string; status: string; scheduledAt: string; mode: string; heldReason: string | null; versionId: string } | null;
  slots: Slot[];
  demo: boolean;
}) {
  const { job, version, assets, publication, demo } = props;
  const [tab, setTab] = useState<"texte" | "pruefung" | "quellen" | "verlauf">("texte");
  const reviewing = ["awaiting_approval", "awaiting_topic_approval", "awaiting_script_approval"].includes(job.status);
  const approvedState = ["approved", "scheduled", "held"].includes(job.status);
  const editable = reviewing || approvedState;
  const tabs = [
    { key: "texte", label: "Texte" },
    { key: "pruefung", label: "Prüfung" },
    { key: "quellen", label: "Quellen & Material" },
    { key: "verlauf", label: "Verlauf" },
  ] as const;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
        {version.stage === "final" ? (
          <MediaPanel assets={assets} format={job.format} versionId={version.id} title={version.title} demo={demo} />
        ) : (
          <div className="card p-5">
            <p className="text-sm font-semibold">{version.stage === "topic" ? "Vorgeschlagenes Thema" : "Skript-Entwurf"}</p>
            <p className="mt-2 font-display text-2xl font-bold tracking-[-0.03em]">{version.title}</p>
            <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{version.stage === "topic" ? version.description : version.script}</p>
          </div>
        )}
        <DecisionPanel {...props} />
      </div>

      <div className="card overflow-hidden">
        <div role="tablist" aria-label="Prüfbereiche" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative whitespace-nowrap rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition",
                tab === t.key ? "text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
              {t.key === "pruefung" && version.autoCheck && version.autoCheck.content.status !== "pass" && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warn align-middle" aria-hidden />}
              {tab === t.key && <motion.span layoutId="review-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-coral" />}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-6" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "texte" && <TextEditor job={job} version={version} editable={editable} approvedState={approvedState} />}
          {tab === "pruefung" && <CheckPanel check={version.autoCheck} assets={assets} />}
          {tab === "quellen" && <SourcesPanel sources={version.sources} assets={assets} />}
          {tab === "verlauf" && <HistoryPanel versions={props.versions} approvals={props.approvals} tz={job.timezone} publication={publication} />}
        </div>
      </div>
    </div>
  );
}

function fmtBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function MediaPanel({ assets, format, versionId, title, demo }: { assets: Asset[]; format: "longform" | "short"; versionId: string; title: string; demo: boolean }) {
  const main = assets.find((a) => a.kind === (format === "short" ? "short" : "video"));
  const audio = assets.find((a) => a.kind === "audio");
  return (
    <div className="card overflow-hidden">
      <div className={cn("relative bg-black", format === "short" ? "flex justify-center py-4" : "")}>
        {main ? (
          <video
            key={main.id}
            controls
            preload="metadata"
            playsInline
            poster={`/api/thumbnails/${versionId}`}
            className={cn(format === "short" ? "aspect-[9/16] max-h-[32rem] rounded-xl" : "aspect-video w-full")}
            aria-label={`${format === "short" ? "Short" : "Video"}: ${title}`}
          >
            <source src={`/api/media/${main.id}`} type={main.mimeType} />
            Dein Browser kann dieses Video nicht abspielen.
          </video>
        ) : (
          <div className="grid aspect-video place-items-center p-6 text-center text-sm text-white/80">
            <span>
              <Film className="mx-auto mb-2 size-6" aria-hidden />
              Für diese Version liegt keine Videodatei vor.
            </span>
          </div>
        )}
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {main && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {demo && <DemoTag>Demo-Ausschnitt</DemoTag>}
            {Math.round(main.durationSec ?? 0)} s · {main.width}×{main.height} · {fmtBytes(main.sizeBytes)}
            {main.editNote && <span>· {main.editNote}</span>}
          </p>
        )}
        {audio && (
          <div className="rounded-2xl border border-line p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileAudio className="size-4 text-coral" aria-hidden /> Voiceover
            </p>
            <audio controls preload="metadata" className="w-full" src={`/api/media/${audio.id}`}>
              Dein Browser kann dieses Audio nicht abspielen.
            </audio>
            {audio.sourceLabel && <p className="mt-1.5 text-xs text-ink-3">{audio.sourceLabel}</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {main && (
            <a href={`/api/media/${main.id}?download=1`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold hover:bg-surface-2">
              <Download className="size-4" aria-hidden /> {format === "short" ? "Short" : "Video"} laden
            </a>
          )}
          {audio && (
            <a href={`/api/media/${audio.id}?download=1`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold hover:bg-surface-2">
              <Download className="size-4" aria-hidden /> Audio
            </a>
          )}
          <a href={`/api/thumbnails/${versionId}?download=1`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold hover:bg-surface-2">
            <Download className="size-4" aria-hidden /> Thumbnail-Entwurf
          </a>
        </div>
        <details className="rounded-2xl bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Thumbnail-Entwurf ansehen</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/thumbnails/${versionId}`} alt={`Thumbnail-Entwurf zu „${title}“`} className="mt-3 w-full rounded-xl border border-line" />
        </details>
      </div>
    </div>
  );
}

function TextEditor({ job, version, editable, approvedState }: { job: Job; version: Version; editable: boolean; approvedState: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    title: version.title,
    description: version.description,
    script: version.script,
    thumbnailText: version.thumbnailText,
    tags: version.tags.join(", "),
    changeNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const dirty =
    form.title !== version.title ||
    form.description !== version.description ||
    form.script !== version.script ||
    form.thumbnailText !== version.thumbnailText ||
    tags.join("|") !== version.tags.join("|");
  const scriptChanged = form.script !== version.script && version.stage === "final";

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const r = await apiFetch<{ number: number; approvalRevoked: boolean; requiresRerender: boolean }>(`/api/jobs/${job.id}/versions`, {
        body: { baseVersionId: version.id, title: form.title, description: form.description, script: form.script, thumbnailText: form.thumbnailText, tags, changeNote: form.changeNote || undefined },
      });
      toast({
        tone: r.approvalRevoked ? "info" : "ok",
        title: `Version ${r.number} gespeichert`,
        text: r.requiresRerender
          ? "Skript geändert – Vertonung und Schnitt werden neu erstellt. Danach erneut prüfen."
          : r.approvalRevoked
            ? "Die bisherige Freigabe gilt nicht mehr. Bitte erneut prüfen und freigeben."
            : "Bitte die neue Version prüfen und freigeben.",
      });
      setConfirm(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast({ tone: "error", title: "Speichern fehlgeschlagen", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const disabled = !editable || version.requiresRerender;
  return (
    <div className="space-y-4">
      {!editable && <InlineAlert tone="info">In diesem Status kann nichts bearbeitet werden.</InlineAlert>}
      {approvedState && (
        <InlineAlert tone="warn" title="Achtung: Diese Version ist freigegeben">
          Wenn du jetzt etwas änderst, entsteht eine neue Version – die Freigabe und der geplante Termin werden aufgehoben, bis du erneut freigibst.
        </InlineAlert>
      )}
      <Field label="Titel" htmlFor="t-title" error={errors.title} hint={`${form.title.length}/100 Zeichen`}>
        <Input id="t-title" value={form.title} maxLength={100} disabled={disabled} onChange={(e) => setForm({ ...form, title: e.target.value })} invalid={!!errors.title} />
      </Field>
      {version.stage !== "topic" && (
        <>
          <Field label="Beschreibung" htmlFor="t-desc" error={errors.description} hint={`${form.description.length}/5000 Zeichen`}>
            <Textarea id="t-desc" rows={5} value={form.description} disabled={disabled} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thumbnail-Text" htmlFor="t-thumb" error={errors.thumbnailText}>
              <Input id="t-thumb" value={form.thumbnailText} maxLength={60} disabled={disabled} onChange={(e) => setForm({ ...form, thumbnailText: e.target.value })} />
            </Field>
            <Field label="Tags (kommagetrennt)" htmlFor="t-tags" error={errors.tags}>
              <Input id="t-tags" value={form.tags} disabled={disabled} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>
          </div>
          <Field label="Skript" htmlFor="t-script" error={errors.script} hint={scriptChanged ? "Skriptänderungen lösen eine neue Vertonung und einen neuen Schnitt aus." : "Wird von der KI-Stimme gesprochen."}>
            <Textarea id="t-script" rows={10} value={form.script} disabled={disabled} onChange={(e) => setForm({ ...form, script: e.target.value })} className="font-[450]" />
          </Field>
        </>
      )}
      {version.stage === "topic" && (
        <Field label="Beschreibung des Vorschlags" htmlFor="t-desc">
          <Textarea id="t-desc" rows={5} value={form.description} disabled={disabled} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      )}
      {editable && (
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
          <Field label="Änderungsnotiz" htmlFor="t-note" optional className="flex-1">
            <Input id="t-note" value={form.changeNote} maxLength={300} onChange={(e) => setForm({ ...form, changeNote: e.target.value })} placeholder="z. B. Titel gekürzt" />
          </Field>
          <Button variant="dark" onClick={() => (approvedState || scriptChanged ? setConfirm(true) : save())} disabled={!dirty || busy || disabled}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden />} Als neue Version speichern
          </Button>
        </div>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Neue Version speichern?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Speichern
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          {approvedState && <li>Die bestehende Freigabe verliert ihre Gültigkeit, der geplante Termin wird abgesagt.</li>}
          {scriptChanged && <li>Das geänderte Skript wird neu vertont und geschnitten (zählt als Überarbeitung, bucht kein neues Kontingent).</li>}
          <li>Danach prüfst und gibst du die neue Version erneut frei.</li>
        </ul>
      </Dialog>
    </div>
  );
}

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 text-ok-ink" aria-label="bestanden" />,
  warn: <AlertTriangle className="size-4 text-warn" aria-label="Hinweis" />,
  fail: <XCircle className="size-4 text-coral" aria-label="Problem" />,
  info: <Info className="size-4 text-info" aria-label="Info" />,
};

function CheckPanel({ check, assets }: { check: AutoCheckResult | null; assets: Asset[] }) {
  if (!check) return <p className="text-sm text-ink-3">Für diese Version liegt keine automatische Prüfung vor.</p>;
  const mediaRights = assets.filter((a) => a.kind !== "thumbnail");
  return (
    <div className="space-y-6">
      <InlineAlert tone="info">Die automatische Prüfung ist eine Entscheidungshilfe. Sie ersetzt nicht deine Freigabe.</InlineAlert>
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-coral" aria-hidden /> Inhalt & Technik
          <Badge tone={check.content.status === "pass" ? "ok" : check.content.status === "warn" ? "warn" : "error"}>
            {check.content.status === "pass" ? "Keine Auffälligkeiten" : check.content.status === "warn" ? "Hinweise" : "Probleme"}
          </Badge>
        </h3>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {check.content.items.map((i) => (
            <li key={i.key} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <span className="mt-0.5">{CHECK_ICON[i.status]}</span>
              <span className="w-36 shrink-0 font-medium">{i.label}</span>
              <span className="text-ink-2">{i.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-4 text-coral" aria-hidden /> Rechte & Herkunft
          <Badge tone={check.rights.status === "clear" ? "ok" : "warn"}>{check.rights.status === "clear" ? "Geklärt" : "Ungeklärt"}</Badge>
        </h3>
        <p className="mb-3 text-sm text-ink-3">Getrennt von der inhaltlichen Qualität. Ein gefundener Clip ist nicht automatisch lizenziert.</p>
        <ul className="space-y-2">
          {check.rights.items.map((r, i) => (
            <li key={i} className="rounded-2xl border border-line px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                <Badge tone={r.status === "unknown" || r.status === "needs_review" ? "warn" : "neutral"}>{RIGHTS_LABEL[r.status] ?? r.status}</Badge>
              </div>
              {r.note && <p className="mt-1 text-ink-3">{r.note}</p>}
            </li>
          ))}
          {mediaRights.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Datei: {a.fileName}</span>
                <Badge tone={a.rightsStatus === "unknown" ? "warn" : "neutral"}>{RIGHTS_LABEL[a.rightsStatus] ?? a.rightsStatus}</Badge>
              </div>
              {(a.sourceLabel || a.license) && <p className="mt-1 text-ink-3">{[a.sourceLabel, a.license].filter(Boolean).join(" · ")}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SourcesPanel({ sources, assets }: { sources: SourceNote[]; assets: Asset[] }) {
  const facts = sources.filter((s) => s.type === "fact");
  const material = sources.filter((s) => s.type !== "fact");
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-semibold">Quellenhinweise</h3>
        {facts.length === 0 ? (
          <p className="text-sm text-ink-3">Keine Quellen zugeordnet.</p>
        ) : (
          <ul className="space-y-2">
            {facts.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line px-4 py-2.5 text-sm">
                <p className="font-medium">{s.title}</p>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex items-center gap-1 break-all text-coral-ink underline">
                    <Link2 className="size-3.5" aria-hidden /> {s.url}
                  </a>
                ) : (
                  <p className="mt-0.5 text-ink-3">Kein Link – {s.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Verwendetes Material</h3>
        <ul className="space-y-2 text-sm">
          {material.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-2.5">
              <span>
                <span className="font-medium">{s.title}</span>
                {s.note && <span className="block text-ink-3">{s.note}</span>}
              </span>
              <Badge tone={s.rightsStatus === "unknown" ? "warn" : "neutral"}>{RIGHTS_LABEL[s.rightsStatus] ?? s.rightsStatus}</Badge>
            </li>
          ))}
          {assets.length === 0 && material.length === 0 && <li className="text-ink-3">Noch kein Material.</li>}
        </ul>
      </section>
    </div>
  );
}

function HistoryPanel({
  versions,
  approvals,
  tz,
  publication,
}: {
  versions: { id: string; number: number; stage: string; createdByType: string; changeNote: string | null; createdAt: string; current: boolean }[];
  approvals: { id: string; decision: string; stage: string; versionNumber: number; comment: string | null; createdAt: string; revokedAt: string | null; revokedReason: string | null; scheduledFor: string | null }[];
  tz: string;
  publication: { status: string; scheduledAt: string; mode: string } | null;
}) {
  const DEC: Record<string, string> = { approved: "Freigegeben", changes_requested: "Änderungen angefordert", rejected: "Verworfen" };
  return (
    <div className="space-y-6 text-sm">
      {publication && (
        <p className="flex flex-wrap items-center gap-2">
          <PublicationBadge status={publication.status} /> {formatInZone(new Date(publication.scheduledAt), tz)}
          {publication.mode === "simulated" && <DemoTag />}
        </p>
      )}
      <section>
        <h3 className="mb-2 font-semibold">Freigaben & Entscheidungen</h3>
        {approvals.length === 0 ? (
          <p className="text-ink-3">Noch keine Entscheidung.</p>
        ) : (
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line px-4 py-2.5">
                <p className="font-medium">
                  {DEC[a.decision]} · Version {a.versionNumber} {a.stage !== "final" && <span className="text-ink-3">({a.stage === "topic" ? "Thema" : "Skript"})</span>}
                </p>
                <p className="text-xs text-ink-3">
                  {formatInZone(new Date(a.createdAt), tz, "d. LLL yyyy, HH:mm")}
                  {a.scheduledFor && ` · Termin ${formatInZone(new Date(a.scheduledFor), tz, "d. LLL, HH:mm")}`}
                </p>
                {a.comment && <p className="mt-1 text-ink-2">„{a.comment}“</p>}
                {a.revokedAt && <p className="mt-1 font-medium text-warn">Aufgehoben: {a.revokedReason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Versionen</h3>
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id} className={cn("flex justify-between gap-2", v.current && "font-semibold")}>
              <span>
                Version {v.number} · {v.createdByType === "user" ? "von dir" : "von Quest"}
                {v.changeNote && <span className="font-normal text-ink-3"> – {v.changeNote}</span>}
              </span>
              <span className="shrink-0 text-ink-3">{formatInZone(new Date(v.createdAt), tz, "d. LLL, HH:mm")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SlotPicker({
  slots,
  tz,
  value,
  onChange,
  suggestedSlotAt,
}: {
  slots: Slot[];
  tz: string;
  value: { at: string | null; adjustment: SlotAdjustment; custom: string };
  onChange: (v: { at: string | null; adjustment: SlotAdjustment; custom: string }) => void;
  suggestedSlotAt: string | null;
}) {
  const [mode, setMode] = useState<"slot" | "custom">(slots.length ? "slot" : "custom");
  const customResolved = useMemo(() => {
    if (!value.custom) return null;
    try {
      return parseLocalDateTimeInput(value.custom, tz);
    } catch {
      return null;
    }
  }, [value.custom, tz]);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Veröffentlichungstermin ({tz})</legend>
      <div className="mb-2 flex gap-1 rounded-full bg-surface-3 p-1 text-sm">
        <button type="button" onClick={() => setMode("slot")} className={cn("flex-1 rounded-full px-3 py-1.5 font-medium", mode === "slot" ? "bg-surface shadow-sm" : "text-ink-3")} disabled={!slots.length}>
          Freier Slot
        </button>
        <button type="button" onClick={() => setMode("custom")} className={cn("flex-1 rounded-full px-3 py-1.5 font-medium", mode === "custom" ? "bg-surface shadow-sm" : "text-ink-3")}>
          Eigener Termin
        </button>
      </div>
      {mode === "slot" ? (
        <ul className="grid max-h-56 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {slots.map((s) => (
            <li key={s.at}>
              <label className={cn("flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm", value.at === s.at ? "border-coral/60 bg-coral-soft/50" : "border-line hover:border-line-strong")}>
                <input type="radio" name="slot" checked={value.at === s.at} onChange={() => onChange({ at: s.at, adjustment: s.adjustment, custom: "" })} className="mt-0.5 accent-[var(--coral-strong)]" />
                <span>
                  {s.label}
                  {(s.isTarget || s.at === suggestedSlotAt) && <span className="block text-xs font-semibold text-coral-ink">{s.isTarget ? "Geplanter Slot" : "Vorschlag"}</span>}
                  {s.adjustmentText && <span className="block text-xs text-warn">{s.adjustmentText}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <label htmlFor="custom-dt" className="sr-only">
            Datum und Uhrzeit
          </label>
          <Input
            id="custom-dt"
            type="datetime-local"
            value={value.custom}
            min={toLocalInputValue(new Date(), tz)}
            onChange={(e) => {
              const custom = e.target.value;
              try {
                const r = parseLocalDateTimeInput(custom, tz);
                onChange({ at: r.utc.toISOString(), adjustment: r.adjustment, custom });
              } catch {
                onChange({ at: null, adjustment: null, custom });
              }
            }}
          />
          {customResolved?.adjustment && <p className="mt-1 text-xs text-warn">{adjustmentText[customResolved.adjustment]}</p>}
          <p className="mt-1 text-xs text-ink-3">Eingabe in {tz}. Gespeichert wird in UTC.</p>
        </div>
      )}
    </fieldset>
  );
}

function DecisionPanel({ job, version, publication, slots, demo }: Parameters<typeof ReviewEditor>[0]) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const initialSlot = slots.find((s) => s.at === job.suggestedSlotAt) ?? slots.find((s) => s.isTarget) ?? slots[0] ?? null;
  const [slot, setSlot] = useState<{ at: string | null; adjustment: SlotAdjustment; custom: string }>({ at: initialSlot?.at ?? null, adjustment: initialSlot?.adjustment ?? null, custom: "" });
  const [dialog, setDialog] = useState<null | "approve" | "changes" | "reject" | "reschedule">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const call = async (path: string, body: unknown, success: (r: Record<string, unknown>) => void) => {
    setBusy(true);
    try {
      const r = await apiFetch<Record<string, unknown>>(path, { body });
      success(r);
      setDialog(null);
      setNote("");
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Das hat nicht geklappt", text: e instanceof ApiError ? e.message : undefined });
      if (e instanceof ApiError && e.status === 409) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const approve = () =>
    call(`/api/jobs/${job.id}/approve`, { versionId: version.id, stage: version.stage, scheduledAt: version.stage === "final" ? slot.at : undefined }, (r) => {
      if (version.stage === "final") {
        const label = String(r.label ?? "");
        setDone(true);
        toast({ tone: "ok", title: "Freigegeben und eingeplant", text: `${label} (${job.timezone})${demo ? " – Demo: Veröffentlichung wird nur simuliert." : ""}` });
      } else {
        toast({ tone: "ok", title: version.stage === "topic" ? "Thema bestätigt" : "Skript bestätigt", text: "Die Produktion läuft weiter." });
      }
    });

  const reviewStatus = ["awaiting_approval", "awaiting_topic_approval", "awaiting_script_approval"].includes(job.status);
  const revisionsLeft = job.maxRevisions - job.revisionCount;

  if (["approved", "scheduled", "held"].includes(job.status) && publication) {
    return (
      <motion.div
        className="card p-5"
        initial={done ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }) : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <CheckCircle2 className="size-5 text-ok-ink" aria-hidden /> Version {version.number} ist freigegeben
        </p>
        <p className="mt-1 text-sm text-ink-2" role={done ? "status" : undefined}>
          {publication.status === "scheduled" ? "Eingeplant für" : "Termin:"} <strong>{formatInZone(new Date(publication.scheduledAt), job.timezone)}</strong> ({job.timezone}) ·{" "}
          <PublicationBadge status={publication.status} /> {publication.mode === "simulated" && <DemoTag>simuliert</DemoTag>}
        </p>
        {publication.status === "scheduled" && (
          <p className="mt-1 text-xs text-ink-3">
            {publication.mode === "simulated" ? "Demo: Die Veröffentlichung wird zum Termin nur simuliert." : "Wird zum Termin veröffentlicht."} Vorher prüft Quest Agent erneut Abo, Freigabe und Kanal.
          </p>
        )}
        {publication.heldReason && <InlineAlert tone="warn" className="mt-3">{HELD_REASON_DE_CLIENT[publication.heldReason] ?? publication.heldReason}</InlineAlert>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog("reschedule")}>
            <CalendarClock className="size-4" aria-hidden /> {publication.heldReason === "slot_passed" ? "Neuen Termin bestätigen" : "Termin ändern"}
          </Button>
        </div>
        <Dialog
          open={dialog === "reschedule"}
          onClose={() => setDialog(null)}
          title="Termin ändern"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Abbrechen
              </Button>
              <Button
                disabled={!slot.at || busy}
                onClick={() =>
                  call(`/api/publications/${publication.id}/reschedule`, slot.custom ? { localDateTime: slot.custom } : { at: slot.at }, (r) =>
                    toast({ tone: "ok", title: "Termin geändert", text: r.status === "held" ? "Wird zurückgehalten, solange das System pausiert ist." : undefined }),
                  )
                }
              >
                {busy && <Loader2 className="size-4 animate-spin" />} Termin speichern
              </Button>
            </>
          }
        >
          <SlotPicker slots={slots} tz={job.timezone} value={slot} onChange={setSlot} suggestedSlotAt={job.suggestedSlotAt} />
        </Dialog>
      </motion.div>
    );
  }

  if (!reviewStatus) {
    return (
      <div className="card p-5 text-sm text-ink-2">
        {version.requiresRerender ? "Das geänderte Skript wird gerade neu produziert. Danach kannst du erneut prüfen." : "Für diesen Auftrag ist gerade keine Entscheidung nötig."}
      </div>
    );
  }

  const selectedLabel = slot.at ? formatInZone(new Date(slot.at), job.timezone) : null;
  return (
    <div className="card relative overflow-hidden p-5">
      <p className="font-display text-xl font-semibold tracking-[-0.02em]">Du hast das letzte Wort.</p>
      <p className="mt-1 text-sm text-ink-3">
        {version.stage === "final"
          ? `Deine Freigabe gilt genau für Version ${version.number}. Änderungen danach heben sie wieder auf.`
          : version.stage === "topic"
            ? "Bestätige das Thema – erst dann wird das Skript geschrieben."
            : "Bestätige das Skript – erst dann wird vertont und geschnitten."}
      </p>
      {job.slotMissedAt && version.stage === "final" && (
        <InlineAlert tone="warn" className="mt-3" title="Ursprünglicher Termin verstrichen">
          Es wurde nichts veröffentlicht. Bitte bestätige einen neuen Termin – der nächste freie Slot ist vorausgewählt.
        </InlineAlert>
      )}
      {job.systemPaused && version.stage === "final" && (
        <InlineAlert tone="info" className="mt-3">
          Das System ist pausiert. Du kannst freigeben – die Veröffentlichung wird bis zur Fortsetzung zurückgehalten.
        </InlineAlert>
      )}
      {version.stage === "final" && (
        <div className="mt-4">
          <SlotPicker slots={slots} tz={job.timezone} value={slot} onChange={setSlot} suggestedSlotAt={job.suggestedSlotAt} />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="approve" size="lg" className="flex-1" disabled={busy || (version.stage === "final" && !slot.at)} onClick={() => setDialog("approve")}>
          <Check className="size-5" aria-hidden /> {version.stage === "final" ? "Freigeben & einplanen" : version.stage === "topic" ? "Thema bestätigen" : "Skript bestätigen"}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setDialog("changes")} disabled={busy || (version.stage === "final" && revisionsLeft <= 0)} title={revisionsLeft <= 0 ? "Überarbeitungslimit erreicht" : undefined}>
          <Undo2 className="size-4" aria-hidden /> {version.stage === "topic" ? "Anderes Thema" : "Änderungen anfordern"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setDialog("reject")} disabled={busy}>
          <Trash2 className="size-4" aria-hidden /> Verwerfen
        </Button>
      </div>
      {version.stage === "final" && (
        <p className="mt-2 text-xs text-ink-3">
          Noch {Math.max(0, revisionsLeft)} von {job.maxRevisions} Überarbeitungen für diesen Auftrag (vorläufige Regel, kein zusätzliches Kontingent).
        </p>
      )}

      <Dialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title={version.stage === "final" ? "Freigeben & einplanen?" : "Bestätigen?"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button variant="approve" onClick={approve} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Ja, freigeben
            </Button>
          </>
        }
      >
        {version.stage === "final" ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-2xl bg-ok-soft px-4 py-3 text-ink">
              <strong>{selectedLabel}</strong>
              <br />
              <span className="text-ink-3">
                Zeitzone {job.timezone} · {job.systemName}
              </span>
            </p>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">
              <li>Freigabe gilt nur für Version {version.number}.</li>
              <li>Es wird nicht sofort veröffentlicht, sondern zum Termin.</li>
              {demo && <li>Demo-Modus: Die Veröffentlichung wird simuliert – nichts geht zu YouTube.</li>}
              {slot.adjustment && <li className="text-warn">{adjustmentText[slot.adjustment]}</li>}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Die Produktion wird mit dieser Version fortgesetzt. Die finale Freigabe erfolgt später.</p>
        )}
      </Dialog>
      <Dialog
        open={dialog === "changes"}
        onClose={() => setDialog(null)}
        title={version.stage === "topic" ? "Anderes Thema anfordern" : "Änderungen anfordern"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button disabled={busy || note.trim().length < 3} onClick={() => call(`/api/jobs/${job.id}/request-changes`, { versionId: version.id, note }, () => toast({ tone: "ok", title: "Überarbeitung angefordert", text: "Du findest das Ergebnis danach wieder in den Freigaben." }))}>
              {busy && <Loader2 className="size-4 animate-spin" />} Anfordern
            </Button>
          </>
        }
      >
        <Field label="Was soll anders werden?" htmlFor="chg-note" hint="Konkrete Hinweise helfen: Ton, Länge, Einstieg, Fakten, Titel …">
          <Textarea id="chg-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </Dialog>
      <Dialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Verwerfen?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button onClick={() => call(`/api/jobs/${job.id}/reject`, { versionId: version.id, reason: note || undefined }, (r) => toast({ tone: "ok", title: "Verworfen", text: r.released ? "Die Reservierung wurde freigegeben." : "Das Kontingent war bereits verbraucht." }))} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Verwerfen
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-2">Der Auftrag wird beendet und nicht veröffentlicht. Fertig produzierte Inhalte zählen weiterhin zum Kontingent.</p>
        <Field label="Grund" htmlFor="rej-note" optional>
          <Input id="rej-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </Dialog>
      <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-3">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Automatische Prüfung ≠ menschliche Freigabe. Unklare Rechte bitte vor der Freigabe klären.
      </p>
    </div>
  );
}

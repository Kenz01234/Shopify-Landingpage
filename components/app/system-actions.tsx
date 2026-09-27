"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pause, Play, Plus, Pencil } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, RadioCard } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError, newKey } from "@/lib/client-api";

export function SystemActions({
  systemId,
  status,
  name,
  longformEnabled,
  shortsEnabled,
  demo,
}: {
  systemId: string;
  status: "active" | "paused" | "archived";
  name: string;
  longformEnabled: boolean;
  shortsEnabled: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const run = async (action: "pause" | "resume" | "archive") => {
    setBusy(action);
    try {
      const r = await apiFetch<{ held?: number; resumed?: number; needsConfirmation?: number; cancelled?: number }>(`/api/systems/${systemId}/${action}`, { body: {} });
      if (action === "pause") toast({ tone: "ok", title: "System pausiert", text: `Keine neuen Zyklen. ${r.held ?? 0} geplante Veröffentlichung(en) werden zurückgehalten.` });
      if (action === "resume")
        toast({
          tone: "ok",
          title: "System fortgesetzt",
          text: `${r.resumed ?? 0} Termin(e) wieder aktiv${r.needsConfirmation ? `, ${r.needsConfirmation} verstrichene(r) Termin(e) brauchen eine Bestätigung im Kalender` : ""}.`,
        });
      if (action === "archive") {
        toast({ tone: "ok", title: "System archiviert", text: `${r.cancelled ?? 0} offene Aufträge abgebrochen, Reservierungen freigegeben.` });
        setArchiveOpen(false);
        router.push("/app/systeme");
      }
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Aktion fehlgeschlagen", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  if (status === "archived") return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setJobOpen(true)} disabled={status !== "active"}>
        <Plus className="size-4" aria-hidden /> Auftrag anlegen
      </Button>
      <ButtonLink href={`/app/systeme/${systemId}/bearbeiten`} variant="secondary">
        <Pencil className="size-4" aria-hidden /> Bearbeiten
      </ButtonLink>
      {status === "active" ? (
        <Button variant="secondary" onClick={() => run("pause")} disabled={!!busy}>
          {busy === "pause" ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" aria-hidden />} Pausieren
        </Button>
      ) : (
        <Button onClick={() => run("resume")} disabled={!!busy}>
          {busy === "resume" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" aria-hidden />} Fortsetzen
        </Button>
      )}
      <Button variant="danger" onClick={() => setArchiveOpen(true)}>
        <Archive className="size-4" aria-hidden /> Archivieren
      </Button>

      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="System archivieren?"
        description="Archivieren beendet diesen Loop geordnet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => run("archive")} disabled={confirmName !== name || !!busy}>
              {busy === "archive" && <Loader2 className="size-4 animate-spin" />} Endgültig archivieren
            </Button>
          </>
        }
      >
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>Offene Aufträge werden abgebrochen, nicht verbrauchte Kontingente freigegeben.</li>
          <li>Geplante Veröffentlichungen werden abgesagt. Bereits veröffentlichte Inhalte bleiben unverändert.</li>
          <li>Medien bleiben in der Bibliothek abrufbar.</li>
        </ul>
        <Field label={`Zur Bestätigung „${name}“ eingeben`} htmlFor="confirm-name">
          <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>

      <NewJobDialog open={jobOpen} onClose={() => setJobOpen(false)} systemId={systemId} longformEnabled={longformEnabled} shortsEnabled={shortsEnabled} demo={demo} />
    </>
  );
}

export function NewJobDialog({
  open,
  onClose,
  systemId,
  longformEnabled,
  shortsEnabled,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  systemId: string;
  longformEnabled: boolean;
  shortsEnabled: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [format, setFormat] = useState<"longform" | "short">(longformEnabled ? "longform" : "short");
  const [scenario, setScenario] = useState("success");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => newKey());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ id: string; created: boolean }>("/api/jobs", { body: { systemId, format, clientKey: key, demoScenario: demo ? scenario : undefined } });
      toast({ tone: "ok", title: r.created ? "Auftrag angelegt" : "Auftrag existierte bereits", text: "Der Worker übernimmt ihn in wenigen Sekunden." });
      setKey(newKey());
      onClose();
      router.push(`/app/produktion/${r.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Auftrag konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Auftrag manuell anlegen"
      description="Zusätzlich zu den automatischen Slot-Aufträgen. Bucht eine Einheit aus dem Kontingent dieses Systems."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Auftrag starten
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Format</legend>
          {longformEnabled && <RadioCard name="format" value="longform" checked={format === "longform"} onChange={() => { setFormat("longform"); if (scenario === "instagram_failure") setScenario("success"); }} title="Longform-Video" text="16:9, deine Ziellänge" />}
          {shortsEnabled && <RadioCard name="format" value="short" checked={format === "short"} onChange={() => setFormat("short")} title="Short" text="9:16, kurz" />}
        </fieldset>
        {demo && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Demo-Szenario</legend>
            <RadioCard name="scenario" value="success" checked={scenario === "success"} onChange={setScenario} title="Normaler Ablauf" text="Läuft bis zur Freigabe-Inbox." />
            <RadioCard name="scenario" value="transient_failure" checked={scenario === "transient_failure"} onChange={setScenario} title="Technischer Fehler mit Wiederholung" text="Rendering schlägt einmal fehl und wird automatisch wiederholt – ohne Doppelbuchung." />
            <RadioCard name="scenario" value="permanent_failure" checked={scenario === "permanent_failure"} onChange={setScenario} title="Dauerhafter Providerfehler" text="Stimmen-Dienst scheitert mehrfach – Auftrag wird angehalten und kann manuell wiederholt werden." />
            {format === "short" && (
              <RadioCard
                name="scenario"
                value="instagram_failure"
                checked={scenario === "instagram_failure"}
                onChange={setScenario}
                title="Instagram lehnt den Upload ab"
                text="YouTube und TikTok klappen, Instagram nicht. „Erneut versuchen“ wiederholt nur Instagram – nichts wird doppelt hochgeladen."
              />
            )}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}

export function DiscardDraftButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await apiFetch("/api/wizard-draft", { method: "DELETE" }).catch(() => undefined);
        router.refresh();
        setBusy(false);
      }}
    >
      Entwurf verwerfen
    </Button>
  );
}

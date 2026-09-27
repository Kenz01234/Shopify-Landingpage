"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";

/**
 * Fragt den Auftragsstatus beim Backend ab (keine Timer-Simulation im Browser)
 * und lädt die Seite neu, sobald sich der Status ändert.
 */
export function JobLiveRefresher({ jobId, status, updatedAt, active }: { jobId: string; status: string; updatedAt: string; active: boolean }) {
  const router = useRouter();
  const last = useRef({ status, updatedAt });
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    last.current = { status, updatedAt };
  }, [status, updatedAt]);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = async () => {
      try {
        const j = await apiFetch<{ status: string; updatedAt: string }>(`/api/jobs/${jobId}`);
        if (stop) return;
        if (j.status !== last.current.status || j.updatedAt !== last.current.updatedAt) {
          last.current = j;
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
          router.refresh();
        }
      } catch {
        /* nächster Versuch */
      }
    };
    const t = setInterval(tick, 1800);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [active, jobId, router]);
  if (!active) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-ink-3" aria-live="polite">
      <Loader2 className={`size-3.5 animate-spin ${pulse ? "text-coral" : ""}`} aria-hidden /> Live aus dem Backend – aktualisiert sich automatisch
    </p>
  );
}

export function JobControls({ jobId, canCancel, canRetry }: { jobId: string; canCancel: boolean; canRetry: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const act = async (action: "cancel" | "retry") => {
    setBusy(action);
    try {
      await apiFetch(`/api/jobs/${jobId}/${action}`, { body: {} });
      toast({
        tone: "ok",
        title: action === "cancel" ? "Auftrag abgebrochen" : "Neuer Versuch gestartet",
        text: action === "cancel" ? "Nicht verbrauchte Kontingente wurden freigegeben." : "Es wird kein zusätzliches Kontingent gebucht.",
      });
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Aktion fehlgeschlagen", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {canRetry && (
        <Button onClick={() => act("retry")} disabled={!!busy}>
          {busy === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" aria-hidden />} Erneut versuchen
        </Button>
      )}
      {canCancel && (
        <Button variant="danger" onClick={() => setConfirm(true)} disabled={!!busy}>
          <XCircle className="size-4" aria-hidden /> Abbrechen
        </Button>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Auftrag abbrechen?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Zurück
            </Button>
            <Button onClick={() => act("cancel")} disabled={!!busy}>
              {busy === "cancel" && <Loader2 className="size-4 animate-spin" />} Ja, abbrechen
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Die Produktion wird gestoppt, ein geplanter Termin abgesagt. Ist das Video noch nicht fertig produziert, wird die Reservierung im Kontingent freigegeben.
        </p>
      </Dialog>
    </>
  );
}

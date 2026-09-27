"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/fields";
import { Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";

export function AdminRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiFetch(`/api/admin/jobs/${jobId}/retry`, { body: {} });
          toast({ tone: "ok", title: "Wiederholung gestartet", text: "Kein zusätzliches Kontingent gebucht." });
          router.refresh();
        } catch (e) {
          toast({ tone: "error", title: "Nicht möglich", text: e instanceof ApiError ? e.message : undefined });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" aria-hidden />} Kontrolliert wiederholen
    </Button>
  );
}

export function DemoResetPanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card className="mt-6 border-coral/30">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.02em]">
        <TriangleAlert className="size-5 text-coral" aria-hidden /> Demo-Szenario zurücksetzen
      </h2>
      <p className="mt-1 text-sm text-ink-3">Nur im lokalen Demo-Modus. Löscht alle Demo-Konten und -Daten und legt sie neu an. Echte Konten bleiben unberührt. Danach ist eine neue Anmeldung nötig.</p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Demo zurücksetzen …
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Demo wirklich zurücksetzen?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={text !== "ZURÜCKSETZEN" || busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await apiFetch("/api/admin/demo-reset", { body: { confirm: text } });
                  window.location.href = "/demo";
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : "Fehlgeschlagen.");
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Zurücksetzen
            </Button>
          </>
        }
      >
        <Field label="Zur Bestätigung ZURÜCKSETZEN eintippen" htmlFor="reset-confirm" error={err}>
          <Input id="reset-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </Card>
  );
}

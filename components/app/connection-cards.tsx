"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Loader2, Send, Workflow, MonitorPlay as YtIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";

type Status = { label: string; tone: "ok" | "warn" | "muted" | "demo" | "error" };

function Card({ icon, title, who, status, children }: { icon: React.ReactNode; title: string; who: string; status: Status; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-coral-soft text-coral">{icon}</span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</h2>
            <p className="text-xs text-ink-3">{who}</p>
          </div>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      <div className="mt-4 flex flex-1 flex-col text-sm text-ink-2">{children}</div>
    </section>
  );
}

export function ConnectionCards({
  demo,
  youtube,
  n8n,
  elevenlabs,
}: {
  demo: boolean;
  youtube: { publishMode: string; oauthConfigured: boolean; status: string; mode: string | null; displayName: string | null; scopes: string[]; tokenExpiresAt: string | null; lastError: string | null };
  n8n: { mode: string; configured: boolean; lastAcceptedAt: string | null };
  elevenlabs: { mode: string; configured: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);

  const yt = async (action: "start" | "demo" | "disconnect") => {
    setBusy(action);
    try {
      const r = await apiFetch<{ redirect?: string }>(`/api/connections/youtube/${action}`, { body: {} });
      if (r.redirect) {
        window.location.href = r.redirect;
        return;
      }
      toast({ tone: "ok", title: action === "demo" ? "Demo-Kanal verbunden (simuliert)" : "Verbindung getrennt" });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Nicht möglich", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const ytStatus: Status =
    youtube.status === "connected"
      ? { label: "Verbunden", tone: "ok" }
      : youtube.status === "demo"
        ? { label: "Demo (simuliert)", tone: "demo" }
        : youtube.status === "revoked" || youtube.status === "expired"
          ? { label: "Zugriff widerrufen", tone: "error" }
          : { label: "Nicht verbunden", tone: "muted" };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card icon={<YtIcon className="size-5" />} title="YouTube-Kanal" who="Dein Kanal · offizieller Google-OAuth-Ablauf" status={ytStatus}>
        {youtube.displayName && <p className="font-medium text-ink">{youtube.displayName}</p>}
        <p className="mt-1">
          {youtube.publishMode === "demo"
            ? "Veröffentlichungen laufen im Demo-Modus und werden nur simuliert – auch mit verbundenem Kanal wird nichts hochgeladen."
            : "Freigegebene Inhalte werden zum Termin über die YouTube Data API hochgeladen."}
        </p>
        <ul className="mt-3 space-y-1 text-xs text-ink-3">
          <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Wir fragen nie nach deinem Google-Passwort.</li>
          <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Minimale Berechtigungen: Upload + Kanal lesen. Token verschlüsselt gespeichert.</li>
        </ul>
        {youtube.lastError && <p className="mt-2 text-xs text-coral-ink">{youtube.lastError}</p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {youtube.status !== "connected" && (
            <Button onClick={() => yt("start")} disabled={!!busy} title={youtube.oauthConfigured ? undefined : "Google-OAuth ist vom Betreiber noch nicht eingerichtet"}>
              {busy === "start" && <Loader2 className="size-4 animate-spin" />} Mit Google verbinden
            </Button>
          )}
          {demo && youtube.status !== "demo" && youtube.status !== "connected" && (
            <Button variant="secondary" onClick={() => yt("demo")} disabled={!!busy}>
              Demo-Kanal verbinden
            </Button>
          )}
          {(youtube.status === "connected" || youtube.status === "demo") && (
            <Button variant="danger" onClick={() => yt("disconnect")} disabled={!!busy}>
              {busy === "disconnect" && <Loader2 className="size-4 animate-spin" />} Trennen
            </Button>
          )}
        </div>
        {!youtube.oauthConfigured && <p className="mt-2 text-xs text-ink-3">Hinweis: GOOGLE_CLIENT_ID/SECRET sind nicht gesetzt – „Mit Google verbinden“ meldet das ehrlich.</p>}
      </Card>

      <Card
        icon={<Workflow className="size-5" />}
        title="Produktion (n8n)"
        who="Betreiber-Verbindung · nicht kundenseitig konfigurierbar"
        status={n8n.mode === "demo" ? { label: "Demo (simuliert)", tone: "demo" } : n8n.configured ? { label: "Konfiguriert", tone: "ok" } : { label: "Nicht verbunden", tone: "error" }}
      >
        <p>
          {n8n.mode === "demo"
            ? "Recherche, Skript und Schnitt werden lokal simuliert. Es werden keine n8n-Workflows aufgerufen."
            : "Aufträge werden an den n8n-Workflow des Betreibers übergeben. Erst eine bestätigte Annahme zählt als Start."}
        </p>
        {n8n.lastAcceptedAt && <p className="mt-2 text-xs text-ink-3">Letzte bestätigte Annahme: {new Date(n8n.lastAcceptedAt).toLocaleString("de-DE")}</p>}
      </Card>

      <Card
        icon={<AudioLines className="size-5" />}
        title="KI-Stimme (ElevenLabs)"
        who="Betreiber-Verbindung · Schlüssel nur serverseitig"
        status={elevenlabs.mode === "demo" ? { label: "Demo-Stimmen", tone: "demo" } : elevenlabs.configured ? { label: "Konfiguriert", tone: "ok" } : { label: "Nicht verbunden", tone: "error" }}
      >
        <p>
          {elevenlabs.mode === "demo"
            ? "Es werden lokale Beispielstimmen verwendet (keine ElevenLabs-Stimmen, keine erfundenen Voice-IDs)."
            : "Stimmen werden aus der konfigurierten ElevenLabs-Auswahl geladen."}
        </p>
        {check && <p className="mt-2 text-xs text-ink-3">{check}</p>}
        <div className="mt-auto pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={!!busy}
            onClick={async () => {
              setBusy("check");
              try {
                const r = await apiFetch<{ ok: boolean; message?: string }>("/api/connections/check", { body: { provider: "elevenlabs" } });
                setCheck(r.message ?? (r.ok ? "Verbunden." : "Nicht verbunden."));
              } catch (e) {
                setCheck(e instanceof ApiError ? e.message : "Prüfung fehlgeschlagen.");
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "check" && <Loader2 className="size-4 animate-spin" />} Verbindung prüfen
          </Button>
        </div>
      </Card>

      <Card icon={<Send className="size-5" />} title="Telegram" who="Geplanter zusätzlicher Zugang" status={{ label: "Später verfügbar", tone: "muted" }}>
        <p>Freigaben und Statusmeldungen sollen später auch per Telegram möglich sein. In dieser Version ist das bewusst noch nicht angebunden.</p>
      </Card>
    </div>
  );
}

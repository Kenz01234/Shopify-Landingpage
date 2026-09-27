"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Loader2, Send, Workflow, ShieldCheck } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
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

export type PlatformConnectionView = {
  platform: PlatformKey;
  publishMode: "simulated" | "live";
  configured: boolean;
  status: string;
  displayName: string | null;
  lastError: string | null;
};

const PLATFORM_COPY: Record<PlatformKey, { title: string; who: string; connectLabel: string; safety: string[]; live: string; credentials: string }> = {
  youtube: {
    title: "YouTube",
    who: "Videos und Shorts · offizieller Google-OAuth-Ablauf",
    connectLabel: "Mit Google verbinden",
    safety: ["Wir fragen nie nach deinem Google-Passwort.", "Minimale Berechtigungen: Upload + Kanal lesen. Token verschlüsselt gespeichert."],
    live: "Freigegebene Inhalte werden zum Termin über die YouTube Data API hochgeladen.",
    credentials: "GOOGLE_CLIENT_ID/SECRET",
  },
  instagram: {
    title: "Instagram",
    who: "Reels · offizieller Instagram-Login",
    connectLabel: "Mit Instagram verbinden",
    safety: ["Braucht ein Instagram-Professional-Konto (Business oder Creator).", "Berechtigungen: Profil lesen + Beiträge veröffentlichen. Token verschlüsselt gespeichert."],
    live: "Freigegebene Shorts werden zum Termin als Reel veröffentlicht.",
    credentials: "INSTAGRAM_APP_ID/SECRET",
  },
  tiktok: {
    title: "TikTok",
    who: "Hochformat-Videos · offizieller TikTok-Login",
    connectLabel: "Mit TikTok verbinden",
    safety: ["Berechtigungen: Profil lesen + Videos veröffentlichen. Token verschlüsselt gespeichert.", "Bis TikTok die App geprüft hat, sind Beiträge nur für dich sichtbar (privat)."],
    live: "Freigegebene Shorts werden zum Termin direkt auf TikTok veröffentlicht.",
    credentials: "TIKTOK_CLIENT_KEY/SECRET",
  },
};

export function ConnectionCards({
  demo,
  platforms,
  n8n,
  elevenlabs,
}: {
  demo: boolean;
  platforms: PlatformConnectionView[];
  n8n: { mode: string; configured: boolean; lastAcceptedAt: string | null };
  elevenlabs: { mode: string; configured: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);

  const act = async (platform: PlatformKey, action: "start" | "demo" | "disconnect") => {
    setBusy(`${platform}:${action}`);
    try {
      const r = await apiFetch<{ redirect?: string }>(`/api/connections/${platform}/${action}`, { body: {} });
      if (r.redirect) {
        window.location.href = r.redirect;
        return;
      }
      toast({ tone: "ok", title: action === "demo" ? `Demo-Verbindung zu ${PLATFORMS[platform].label} hergestellt (simuliert)` : "Verbindung getrennt" });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Nicht möglich", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const statusOf = (v: PlatformConnectionView): Status =>
    v.status === "connected"
      ? { label: "Verbunden", tone: "ok" }
      : v.status === "demo"
        ? { label: "Demo (simuliert)", tone: "demo" }
        : v.status === "revoked" || v.status === "expired"
          ? { label: "Zugriff widerrufen", tone: "error" }
          : { label: "Nicht verbunden", tone: "muted" };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="grid gap-5 lg:col-span-2 lg:grid-cols-3">
        {platforms.map((v) => {
          const copy = PLATFORM_COPY[v.platform];
          const b = (a: string) => busy === `${v.platform}:${a}`;
          return (
            <Card key={v.platform} icon={<PlatformIcon platform={v.platform} className="size-6 rounded-lg" />} title={copy.title} who={copy.who} status={statusOf(v)}>
              {v.displayName && <p className="font-medium text-ink">{v.displayName}</p>}
              <p className="mt-1">
                {v.publishMode === "simulated"
                  ? "Veröffentlichungen werden nur simuliert – auch mit verbundenem Konto wird nichts hochgeladen."
                  : copy.live}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-ink-3">
                {copy.safety.map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {line}
                  </li>
                ))}
              </ul>
              {v.lastError && <p className="mt-2 text-xs text-coral-ink">{v.lastError}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {v.status !== "connected" && (
                  <Button onClick={() => act(v.platform, "start")} disabled={!!busy} title={v.configured ? undefined : `${copy.title}-Anbindung ist vom Betreiber noch nicht eingerichtet`}>
                    {b("start") && <Loader2 className="size-4 animate-spin" />} {copy.connectLabel}
                  </Button>
                )}
                {demo && v.status !== "demo" && v.status !== "connected" && (
                  <Button variant="secondary" onClick={() => act(v.platform, "demo")} disabled={!!busy}>
                    {b("demo") && <Loader2 className="size-4 animate-spin" />} Demo verbinden
                  </Button>
                )}
                {(v.status === "connected" || v.status === "demo") && (
                  <Button variant="danger" onClick={() => act(v.platform, "disconnect")} disabled={!!busy}>
                    {b("disconnect") && <Loader2 className="size-4 animate-spin" />} Trennen
                  </Button>
                )}
              </div>
              {!v.configured && <p className="mt-2 text-xs text-ink-3">Hinweis: {copy.credentials} sind nicht gesetzt – „{copy.connectLabel}“ meldet das ehrlich.</p>}
            </Card>
          );
        })}
      </div>

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

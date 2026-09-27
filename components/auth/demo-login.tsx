"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Shield, UserRound, Users } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client-api";
import { InlineAlert } from "@/components/ui/misc";

const OPTIONS = [
  { key: "kunde", title: "Als Demo-Kundin starten", text: "Studio-Plan, zwei Systeme, Aufträge in allen Zuständen.", icon: UserRound, primary: true },
  { key: "zweiter", title: "Als zweiter Demo-Kunde", text: "Eigener Mandant – zum Prüfen der Datentrennung.", icon: Users },
  { key: "admin", title: "Admin-Ansicht", text: "Kunden, Systeme und Jobs überblicken.", icon: Shield },
] as const;

export function DemoLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async (account: string) => {
    setBusy(account);
    setError(null);
    try {
      const r = await apiFetch<{ redirect: string }>("/api/demo/login", { body: { account } });
      router.push(r.redirect);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Demo-Anmeldung fehlgeschlagen.");
      setBusy(null);
    }
  };
  return (
    <div className="mt-8 space-y-3">
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => go(o.key)}
          disabled={!!busy}
          className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
            "primary" in o && o.primary ? "border-coral/50 bg-coral-soft/60 hover:border-coral" : "border-line bg-surface hover:border-line-strong"
          }`}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-coral shadow-sm">
            {busy === o.key ? <Loader2 className="size-5 animate-spin" /> : <o.icon className="size-5" />}
          </span>
          <span className="flex-1">
            <span className="block font-semibold">{o.title}</span>
            <span className="block text-sm text-ink-3">{o.text}</span>
          </span>
          <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5" aria-hidden />
        </button>
      ))}
      <p className="text-xs text-ink-3">Demo-Konten existieren nur lokal (Seed) und sind im Produktionsbetrieb deaktiviert.</p>
    </div>
  );
}

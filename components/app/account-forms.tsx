"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { Card, InlineAlert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";
import { authClient } from "@/lib/auth-client";

export function AccountForms({ name, email, orgName, isOwner, isDemo, sessions }: { name: string; email: string; orgName: string; isOwner: boolean; isDemo: boolean; sessions: number }) {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState({ name, organizationName: orgName });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwError, setPwError] = useState<string | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("profile");
    setErrors({});
    try {
      await apiFetch("/api/account", { method: "PATCH", body: profile });
      toast({ tone: "ok", title: "Profil gespeichert" });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast({ tone: "error", title: "Speichern fehlgeschlagen", text: err instanceof ApiError ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next.length < 10) return setPwError("Das neue Passwort braucht mindestens 10 Zeichen.");
    setBusy("pw");
    const { error } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
    setBusy(null);
    if (error) return setPwError("Das aktuelle Passwort ist nicht korrekt.");
    setPw({ current: "", next: "" });
    toast({ tone: "ok", title: "Passwort geändert", text: "Andere Sitzungen wurden abgemeldet." });
  };

  const logout = async () => {
    setBusy("logout");
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em]">Profil</h2>
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="acc-name" error={errors.name}>
            <Input id="acc-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} invalid={!!errors.name} />
          </Field>
          <Field label="Organisation / Kanalstudio" htmlFor="acc-org" error={errors.organizationName} hint={isOwner ? undefined : "Nur Inhaber können den Namen ändern."}>
            <Input id="acc-org" value={profile.organizationName} disabled={!isOwner} onChange={(e) => setProfile({ ...profile, organizationName: e.target.value })} />
          </Field>
          <Field label="E-Mail-Adresse" htmlFor="acc-mail" hint="Die Änderung der E-Mail-Adresse erfordert eine Bestätigungs-E-Mail und ist in dieser Version noch nicht verfügbar.">
            <Input id="acc-mail" value={email} disabled readOnly />
          </Field>
          <Button type="submit" disabled={busy === "profile"}>
            {busy === "profile" && <Loader2 className="size-4 animate-spin" />} Speichern
          </Button>
        </form>
      </Card>
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em]">Passwort</h2>
          {isDemo ? (
            <InlineAlert tone="info">Für Demo-Konten ist die Passwortänderung deaktiviert, damit der Demo-Einstieg funktioniert.</InlineAlert>
          ) : (
            <form onSubmit={changePassword} className="space-y-4" noValidate>
              {pwError && <InlineAlert tone="error">{pwError}</InlineAlert>}
              <Field label="Aktuelles Passwort" htmlFor="pw-cur">
                <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
              <Field label="Neues Passwort" htmlFor="pw-new" hint="Mindestens 10 Zeichen.">
                <Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Button type="submit" variant="secondary" disabled={busy === "pw" || !pw.current || !pw.next}>
                {busy === "pw" && <Loader2 className="size-4 animate-spin" />} Passwort ändern
              </Button>
            </form>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold tracking-[-0.02em]">Sitzung</h2>
          <p className="text-sm text-ink-3">{sessions} aktive Sitzung(en). Sitzungen sind HttpOnly-Cookies und laufen nach 7 Tagen ab.</p>
          <Button variant="secondary" className="mt-4" onClick={logout} disabled={busy === "logout"}>
            {busy === "logout" ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" aria-hidden />} Abmelden
          </Button>
        </Card>
      </div>
    </div>
  );
}

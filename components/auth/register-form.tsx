"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/misc";

export function RegisterForm({ plan }: { plan: "starter" | "studio" | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Bitte deinen Namen angeben.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Bitte eine gültige E-Mail-Adresse angeben.";
    if (password.length < 10) e.password = "Mindestens 10 Zeichen.";
    if (!accepted) e.accepted = "Bitte bestätigen.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setFormError(null);
    const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
    if (error) {
      setBusy(false);
      setFormError(
        error.code === "USER_ALREADY_EXISTS" || error.status === 422
          ? "Für diese E-Mail-Adresse gibt es bereits ein Konto."
          : error.status === 429
            ? "Zu viele Versuche. Bitte kurz warten."
            : "Registrierung fehlgeschlagen. Bitte Eingaben prüfen.",
      );
      return;
    }
    router.push(`/app/abo${plan ? `?plan=${plan}` : "?start=1"}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
      {formError && <InlineAlert tone="error">{formError}</InlineAlert>}
      <Field label="Name" htmlFor="name" error={errors.name}>
        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
      </Field>
      <Field label="E-Mail-Adresse" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
      </Field>
      <Field label="Passwort" htmlFor="password" error={errors.password} hint="Mindestens 10 Zeichen.">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm text-ink-2">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 accent-[var(--coral-strong)]" />
          <span>
            Ich habe die <Link href="/agb" className="font-medium underline">AGB</Link> und{" "}
            <Link href="/datenschutz" className="font-medium underline">Datenschutzhinweise</Link> zur Kenntnis genommen. (Vorschauversion – Texte sind noch Entwürfe.)
          </span>
        </label>
        {errors.accepted && <p className="mt-1 text-sm font-medium text-coral-ink">{errors.accepted}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Konto anlegen & weiter
      </Button>
      <p className="text-center text-xs text-ink-3">Keine Zahlung in diesem Schritt.</p>
    </form>
  );
}

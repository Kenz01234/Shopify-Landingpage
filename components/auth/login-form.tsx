"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/misc";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setBusy(false);
      setError(error.status === 429 ? "Zu viele Versuche. Bitte kurz warten." : "E-Mail-Adresse oder Passwort ist nicht korrekt.");
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      <Field label="E-Mail-Adresse" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Passwort" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Anmelden
      </Button>
    </form>
  );
}

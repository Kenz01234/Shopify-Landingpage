"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/misc";
import { apiFetch, ApiError } from "@/lib/client-api";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", topic: "frage", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    setErrors({});
    try {
      await apiFetch("/api/contact", { body: f });
      setState("done");
    } catch (err) {
      setState("error");
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setMsg(err.message);
      }
    }
  };
  if (state === "done") {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <CheckCircle2 className="size-10 text-ok-ink" aria-hidden />
        <p className="mt-3 font-display text-xl font-semibold">Danke – deine Nachricht ist gespeichert.</p>
        <p className="mt-1 text-ink-3">In dieser Vorschau wird keine E-Mail verschickt.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8" noValidate>
      {state === "error" && msg && <InlineAlert tone="error">{msg}</InlineAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" error={errors.name}>
          <Input id="c-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} invalid={!!errors.name} />
        </Field>
        <Field label="E-Mail-Adresse" htmlFor="c-mail" error={errors.email}>
          <Input id="c-mail" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} invalid={!!errors.email} />
        </Field>
      </div>
      <Field label="Worum geht es?" htmlFor="c-topic">
        <Select id="c-topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
          <option value="frage">Frage zum Produkt</option>
          <option value="demo">Persönliche Demo</option>
          <option value="partnerschaft">Partnerschaft</option>
          <option value="sonstiges">Sonstiges</option>
        </Select>
      </Field>
      <Field label="Nachricht" htmlFor="c-msg" error={errors.message}>
        <Textarea id="c-msg" rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} invalid={!!errors.message} maxLength={3000} />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="c-web">Website</label>
        <input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </div>
      <p className="text-xs text-ink-3">Wir verwenden deine Angaben nur zur Beantwortung der Anfrage (siehe Datenschutz-Entwurf).</p>
      <Button type="submit" disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="size-4 animate-spin" />} Nachricht senden
      </Button>
    </form>
  );
}

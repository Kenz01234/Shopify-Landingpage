"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Check, Loader2, ArrowRight, CreditCard, AlertTriangle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert, Meter } from "@/components/ui/misc";
import { Badge, DemoTag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/client-api";
import { PLANS, PLAN_ORDER, ASSUMPTIONS, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/cn";

type Sub = {
  plan: PlanKey;
  status: string;
  provider: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  pendingPlan: PlanKey | null;
  demoFailNextRenewal: boolean;
};
type Q = { limit: number; reserved: number; consumed: number; free: number };

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "error" | "muted" }> = {
  active: { label: "Aktiv", tone: "ok" },
  past_due: { label: "Zahlung offen", tone: "error" },
  canceled: { label: "Beendet", tone: "muted" },
  incomplete: { label: "Unvollständig", tone: "warn" },
};

const d = (s: string) => new Date(s).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

export function BillingPanel({
  provider,
  demo,
  preselect,
  checkoutState,
  hasSystems,
  subscription,
  quota,
  shopAccountUrl,
}: {
  provider: "demo" | "stripe";
  /** Kundenkonto des Shops (Abos, die über Shopify gekauft wurden, werden dort verwaltet) */
  shopAccountUrl: string | null;
  demo: boolean;
  preselect: PlanKey | null;
  checkoutState: string | null;
  hasSystems: boolean;
  now: string;
  subscription: Sub | null;
  quota: { longform: Q; short: Q; periodStart: string; periodEnd: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [plan, setPlan] = useState<PlanKey>(preselect ?? subscription?.plan ?? "studio");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "cancel" | "change">(null);
  const shopManaged = subscription?.provider === "shopify";
  const active = subscription && subscription.status !== "canceled";

  const post = async (path: string, body: unknown, onOk?: (r: Record<string, unknown>) => void) => {
    setBusy(path);
    try {
      const r = await apiFetch<Record<string, unknown>>(path, { body });
      if (typeof r.redirect === "string") {
        window.location.href = r.redirect;
        return;
      }
      onOk?.(r);
      setConfirm(null);
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Das hat nicht geklappt", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const checkout = () =>
    post("/api/billing/checkout", { plan }, () => {
      toast({ tone: "ok", title: `${PLANS[plan].name}-Plan aktiv`, text: demo ? "Demo-Abo – es wurde nichts abgebucht." : undefined });
      router.push(hasSystems ? "/app" : "/app/systeme/neu");
    });

  return (
    <div className="space-y-8">
      {checkoutState === "pruefen" && (
        <InlineAlert tone="info" title="Zahlung wird geprüft">
          Dein Zugang wird freigeschaltet, sobald Stripe die Zahlung serverseitig bestätigt (Webhook). Eine Erfolgsseite im Browser allein schaltet nichts frei.
        </InlineAlert>
      )}
      {checkoutState === "abgebrochen" && <InlineAlert tone="warn">Checkout abgebrochen – es wurde nichts geändert.</InlineAlert>}

      {active && subscription && quota && (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Aktueller Plan</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-[-0.04em]">
                {PLANS[subscription.plan].name} <span className="text-lg font-medium text-ink-3">{PLANS[subscription.plan].priceEurMonthly} € / Monat</span>
              </p>
              <p className="mt-1 text-sm text-ink-3">
                Abrechnungszeitraum {d(quota.periodStart)} – {d(quota.periodEnd)} · Anbieter: {subscription.provider === "demo" ? "Demo-Billing (simuliert)" : shopManaged ? "Shop (Shopify)" : "Stripe"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS[subscription.status].tone} dot>
                {STATUS[subscription.status].label}
              </Badge>
              {subscription.provider === "demo" && <DemoTag>keine Zahlung</DemoTag>}
            </div>
          </div>
          {subscription.cancelAtPeriodEnd && (
            <InlineAlert tone="warn" className="mt-4" title={`Gekündigt zum ${d(subscription.currentPeriodEnd)}`}>
              Bis dahin läuft alles normal weiter. Danach werden keine neuen Aufträge erstellt und geplante Veröffentlichungen zurückgehalten.
            </InlineAlert>
          )}
          {subscription.pendingPlan && (
            <InlineAlert tone="info" className="mt-4">
              Wechsel zu {PLANS[subscription.pendingPlan].name} wird am {d(subscription.currentPeriodEnd)} wirksam.
            </InlineAlert>
          )}
          {subscription.status === "past_due" && (
            <InlineAlert tone="error" className="mt-4" title="Verlängerung fehlgeschlagen">
              Neue Produktionen und Veröffentlichungen sind angehalten, bis die Zahlung erfolgt ist.
            </InlineAlert>
          )}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Meter label="Longform-Videos" used={quota.longform.consumed} reserved={quota.longform.reserved} limit={quota.longform.limit} />
            <Meter label="Shorts" used={quota.short.consumed} reserved={quota.short.reserved} limit={quota.short.limit} />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Reserviert = Auftrag angelegt/in Produktion. Verbraucht = fertig produziert. Technische Wiederholungen und bis zu {ASSUMPTIONS.maxRevisionsPerJob} Überarbeitungen pro Auftrag
            buchen nicht erneut. Nicht genutzte Mengen verfallen am Periodenende (vorläufige Annahme).
          </p>
          {shopManaged ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink-2">Dieses Abo hast du im Shop gekauft. Planwechsel, Zahlungsdaten und Kündigung verwaltest du im Kundenkonto des Shops.</p>
              {shopAccountUrl && (
                <a href={shopAccountUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">
                  <CreditCard className="size-4" aria-hidden /> Im Shop verwalten
                </a>
              )}
            </div>
          ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {subscription.cancelAtPeriodEnd ? (
              <Button onClick={() => post("/api/billing/resume", {}, () => toast({ tone: "ok", title: "Kündigung zurückgenommen" }))} disabled={!!busy}>
                Kündigung zurücknehmen
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirm("cancel")} disabled={!!busy}>
                Zum Periodenende kündigen
              </Button>
            )}
            {provider === "stripe" && (
              <Button variant="secondary" onClick={() => post("/api/billing/portal", {})} disabled={!!busy}>
                <CreditCard className="size-4" aria-hidden /> Zahlungsdaten verwalten
              </Button>
            )}
          </div>
          )}
          {demo && subscription.provider === "demo" && (
            <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface-2 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FlaskConical className="size-4 text-coral" aria-hidden /> Demo-Szenarien <DemoTag />
              </p>
              <p className="mt-1 text-sm text-ink-3">Zum Ausprobieren von Verlängerung, Zahlungsausfall und Periodenwechsel. Alles bleibt lokal.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={!!busy || subscription.demoFailNextRenewal} onClick={() => post("/api/billing/demo", { action: "fail_next_renewal" }, () => toast({ tone: "info", title: "Nächste Verlängerung schlägt fehl (Demo)" }))}>
                  <AlertTriangle className="size-4" aria-hidden /> Nächste Verlängerung fehlschlagen lassen
                </Button>
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => post("/api/billing/demo", { action: "end_period_now" }, (r) => toast({ tone: "info", title: "Periode beendet (Demo)", text: `Status: ${STATUS[String(r.status)]?.label ?? r.status}` }))}>
                  Periode jetzt beenden
                </Button>
                {subscription.status === "past_due" && (
                  <Button size="sm" disabled={!!busy} onClick={() => post("/api/billing/demo", { action: "pay_now" }, () => toast({ tone: "ok", title: "Zahlung nachgeholt (Demo)" }))}>
                    Zahlung nachholen
                  </Button>
                )}
              </div>
              {subscription.demoFailNextRenewal && <p className="mt-2 text-xs text-warn">Aktiv: Die nächste Verlängerung wird fehlschlagen.</p>}
            </div>
          )}
        </section>
      )}

      {!shopManaged && (
      <>
      <section aria-labelledby="plans">
        <h2 id="plans" className="mb-4 font-display text-xl font-semibold tracking-[-0.02em]">
          {active ? "Plan wechseln" : "Pläne"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {PLAN_ORDER.map((k) => {
            const p = PLANS[k];
            const current = active && subscription?.plan === k;
            const selected = plan === k;
            return (
              <motion.label
                key={k}
                className={cn("card relative flex cursor-pointer flex-col p-5 transition", selected ? "ring-2 ring-coral/60" : "hover:border-line-strong")}
                whileHover={reduce ? undefined : { y: -2 }}
              >
                <input type="radio" name="plan" value={k} checked={selected} onChange={() => setPlan(k)} className="sr-only" />
                {k === "studio" && <span className="absolute -top-3 right-5 rounded-full bg-ink px-3 py-1 text-xs font-bold text-bg">Mehr Takt</span>}
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-bold tracking-[-0.03em]">{p.name}</p>
                  <span className={cn("grid size-6 place-items-center rounded-full border", selected ? "border-coral bg-coral text-white" : "border-line-strong")}>{selected && <Check className="size-4" strokeWidth={3} />}</span>
                </div>
                <p className="mt-1 text-sm text-ink-3">{p.tagline}</p>
                <p className="mt-4">
                  <span className="font-display text-4xl font-bold tracking-[-0.04em]">{p.priceEurMonthly} €</span>
                  <span className="text-ink-3"> / Monat</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Check className="size-4 shrink-0 text-coral" aria-hidden /> {p.longformPerPeriod} Videos à {p.longformMaxMinutes} Minuten
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 shrink-0 text-coral" aria-hidden /> {p.shortsPerPeriod} Shorts
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 shrink-0 text-coral" aria-hidden /> Freigabe-Inbox, Kalender, Medienbibliothek
                  </li>
                </ul>
                {current && <Badge tone="ok" className="mt-4 self-start">Aktueller Plan</Badge>}
              </motion.label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Vorläufige Preise (Vorschlag). Steuerdarstellung, Vertragslaufzeit und weitere Konditionen sind noch nicht final festgelegt. Keine Garantie für Reichweite oder Einnahmen.
        </p>
      </section>

      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {active && subscription ? (
          <>
            <p className="text-sm text-ink-2">
              {plan === subscription.plan
                ? subscription.pendingPlan
                  ? "Ausstehenden Wechsel verwerfen und beim aktuellen Plan bleiben."
                  : "Das ist dein aktueller Plan."
                : plan === "studio"
                  ? "Upgrade gilt sofort – das Kontingent dieses Zeitraums wird angehoben."
                  : "Wechsel auf Starter wird zum Periodenende wirksam."}
            </p>
            <Button onClick={() => setConfirm("change")} disabled={!!busy || (plan === subscription.plan && !subscription.pendingPlan)}>
              {plan === subscription.plan ? "Beim aktuellen Plan bleiben" : `Zu ${PLANS[plan].name} wechseln`}
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="font-semibold">
                {PLANS[plan].name} · {PLANS[plan].priceEurMonthly} € / Monat
              </p>
              <p className="text-sm text-ink-3">
                {provider === "demo" ? "Demo-Checkout: Es wird nichts abgebucht, das Abo wird lokal simuliert." : "Weiter zu Stripe (Testmodus). Freischaltung erst nach serverseitiger Bestätigung."}
              </p>
            </div>
            <Button size="lg" onClick={checkout} disabled={!!busy} shine>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {provider === "demo" ? "Demo-Abo aktivieren" : "Weiter zur Zahlung"} <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
      </>
      )}

      <Dialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        title="Zum Periodenende kündigen?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Zurück
            </Button>
            <Button onClick={() => post("/api/billing/cancel", {}, () => toast({ tone: "ok", title: "Gekündigt zum Periodenende" }))} disabled={!!busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Kündigen
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {subscription && `Dein Plan läuft bis ${d(subscription.currentPeriodEnd)} weiter.`} Danach entstehen keine neuen Aufträge, geplante Veröffentlichungen werden zurückgehalten. Du kannst die Kündigung bis dahin zurücknehmen.
        </p>
      </Dialog>
      <Dialog
        open={confirm === "change"}
        onClose={() => setConfirm(null)}
        title="Plan ändern?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Zurück
            </Button>
            <Button onClick={() => post("/api/billing/change-plan", { plan }, () => toast({ tone: "ok", title: "Plan aktualisiert" }))} disabled={!!busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Bestätigen
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {plan === "studio" ? "Studio gilt sofort mit höherem Kontingent." : plan === subscription?.plan ? "Der ausstehende Wechsel wird verworfen." : "Starter gilt ab dem nächsten Abrechnungszeitraum."}{" "}
          {demo && "Demo: Es wird nichts abgebucht."}
        </p>
      </Dialog>
    </div>
  );
}

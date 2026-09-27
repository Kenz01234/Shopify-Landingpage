"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, Clock, FastForward, Loader2, Plus, RotateCcw, CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/fields";
import { InlineAlert } from "@/components/ui/misc";
import { Badge, DemoTag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { FormatTag, PublicationBadge, JobStatusBadge } from "@/components/app/bits";
import { PlatformChip, PlatformIcons } from "@/components/brand/platform-icon";
import { apiFetch, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { WEEKDAYS_LONG_DE, parseLocalDateTimeInput, toLocalInputValue, adjustmentText } from "@/lib/time";
import type { CalendarItem } from "@/lib/publishing";
import type { JobStatus } from "@/generated/prisma/enums";
import { HELD_REASON_DE_CLIENT } from "@/components/app/review/held-reasons";

type Sys = { id: string; name: string; timezone: string; longformEnabled: boolean; shortsEnabled: boolean; status: string };

const LEGEND = [
  { label: "Wartet auf Freigabe", cls: "border-l-warn bg-warn-soft" },
  { label: "Geplant", cls: "border-l-violet bg-violet-soft" },
  { label: "Zurückgehalten", cls: "border-l-warn bg-warn-soft/60" },
  { label: "Demo-veröffentlicht / online", cls: "border-l-ok bg-ok-soft" },
  { label: "Fehlgeschlagen", cls: "border-l-coral bg-coral-soft" },
];

function itemClass(i: CalendarItem) {
  if (i.kind === "pending") return i.slotMissed ? "border-l-coral bg-coral-soft/70" : "border-l-warn bg-warn-soft";
  if (i.status === "scheduled") return "border-l-violet bg-violet-soft";
  if (i.status === "held") return "border-l-warn bg-warn-soft/60";
  if (i.status === "simulated" || i.status === "published") return "border-l-ok bg-ok-soft";
  if (i.status === "failed") return "border-l-coral bg-coral-soft";
  return "border-l-line-strong bg-surface-3";
}

export function CalendarView({
  tz,
  zones,
  weekStart,
  nowIso,
  items,
  systems,
  demo,
}: {
  tz: string;
  zones: string[];
  weekStart: string;
  nowIso: string;
  items: CalendarItem[];
  systems: Sys[];
  demo: { offsetMinutes: number; nextPublicationAt: string | null } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const start = DateTime.fromISO(weekStart, { zone: tz });
  const now = DateTime.fromISO(nowIso, { zone: tz });
  const days = Array.from({ length: 14 }, (_, i) => start.plus({ days: i }));
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const k = DateTime.fromISO(it.at, { zone: tz }).toISODate()!;
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return map;
  }, [items, tz]);
  const href = (d: DateTime) => `/app/kalender?woche=${d.toISODate()}${zones.length > 1 ? `&tz=${encodeURIComponent(tz)}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={href(start.minus({ weeks: 1 }))} className="grid size-10 place-items-center rounded-full border border-line bg-surface hover:border-line-strong" aria-label="Vorherige Woche">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={href(now)} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-line-strong">
            Heute
          </Link>
          <Link href={href(start.plus({ weeks: 1 }))} className="grid size-10 place-items-center rounded-full border border-line bg-surface hover:border-line-strong" aria-label="Nächste Woche">
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <p className="font-display text-lg font-semibold tracking-[-0.02em]">
          KW {start.weekNumber}–{start.plus({ weeks: 1 }).weekNumber} · {start.setLocale("de").toFormat("d. LLL")} – {start.plus({ days: 13 }).setLocale("de").toFormat("d. LLL yyyy")}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {zones.length > 1 && (
            <Select aria-label="Anzeige-Zeitzone" value={tz} onChange={(e) => router.push(`/app/kalender?woche=${weekStart}&tz=${encodeURIComponent(e.target.value)}`)} className="w-48">
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </Select>
          )}
          <Badge tone="neutral">{tz}</Badge>
          <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={!systems.some((s) => s.status !== "archived")}>
            <Plus className="size-4" aria-hidden /> Slot ergänzen
          </Button>
        </div>
      </div>

      {demo && <DemoClock demo={demo} tz={tz} nowIso={nowIso} />}

      {/* Wochenraster ab md, Liste darunter */}
      <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface md:grid md:grid-cols-7">
        {days.map((d) => {
          const k = d.toISODate()!;
          const list = byDay.get(k) ?? [];
          const isToday = d.hasSame(now, "day");
          return (
            <section key={k} className={cn("min-h-48 border-line p-2 [&:not(:nth-child(7n))]:border-r [&:nth-child(-n+7)]:border-b", isToday && "bg-coral-soft/25", d < now.startOf("day") && "bg-surface-2/60")} aria-label={d.setLocale("de").toFormat("cccc, d. LLLL")}>
              <header className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{d.setLocale("de").toFormat("ccc")}</span>
                <span className={cn("grid size-7 place-items-center rounded-full text-sm font-semibold", isToday ? "bg-coral-strong text-white" : "text-ink")}>{d.day}</span>
              </header>
              <ul className="space-y-1.5">
                {list.map((it) => (
                  <li key={it.id}>
                    <CalendarChip item={it} tz={tz} onOpen={() => setSelected(it)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="space-y-4 md:hidden">
        {days.map((d) => {
          const list = byDay.get(d.toISODate()!) ?? [];
          const isToday = d.hasSame(now, "day");
          return (
            <section key={d.toISODate()} aria-label={d.setLocale("de").toFormat("cccc, d. LLLL")}>
              <h3 className={cn("mb-2 text-sm font-semibold", isToday ? "text-coral-ink" : "text-ink-2")}>
                {d.setLocale("de").toFormat("cccc, d. LLLL")} {isToday && "· heute"}
              </h3>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-ink-3">Nichts geplant</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((it) => (
                    <li key={it.id}>
                      <CalendarChip item={it} tz={tz} onOpen={() => setSelected(it)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-3" aria-label="Legende">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-4 rounded-sm border-l-4", l.cls)} aria-hidden /> {l.label}
          </li>
        ))}
      </ul>

      <ItemDialog item={selected} onClose={() => setSelected(null)} nowIso={nowIso} />
      <AddSlotDialog open={addOpen} onClose={() => setAddOpen(false)} systems={systems.filter((s) => s.status !== "archived")} />
    </div>
  );
}

function CalendarChip({ item, tz, onOpen }: { item: CalendarItem; tz: string; onOpen: () => void }) {
  const t = DateTime.fromISO(item.at, { zone: tz });
  return (
    <button type="button" onClick={onOpen} className={cn("w-full rounded-lg border border-line border-l-4 px-2 py-1.5 text-left transition hover:shadow-md", itemClass(item))}>
      <span className="flex items-center justify-between gap-1 text-[0.72rem] font-semibold text-ink-2">
        <span className="flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {t.toFormat("HH:mm")}
          {item.timezone !== tz && <span className="font-normal">({DateTime.fromISO(item.at, { zone: item.timezone }).toFormat("HH:mm")} lokal)</span>}
        </span>
        <FormatTag format={item.format} className="scale-90" />
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[0.78rem] font-medium leading-snug text-ink">{item.title}</span>
      <PlatformIcons platforms={item.platforms} className="mt-1" />
      <span className="mt-0.5 block truncate text-[0.68rem] text-ink-3">
        {item.systemName} · {item.kind === "pending" ? (item.slotMissed ? "Termin verstrichen" : "wartet auf Produktion/Freigabe") : item.mode === "simulated" ? `${statusLabel(item.status)} · Demo` : statusLabel(item.status)}
      </span>
    </button>
  );
}

function statusLabel(s: string) {
  return ({ scheduled: "geplant", held: "zurückgehalten", simulated: "simuliert", published: "online", failed: "fehlgeschlagen", publishing: "läuft", reconciling: "wird abgeglichen" } as Record<string, string>)[s] ?? s;
}

function ItemDialog({ item, onClose, nowIso }: { item: CalendarItem | null; onClose: () => void; nowIso: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = !!item;
  const tz = item?.timezone ?? "Europe/Berlin";
  const resolved = useMemo(() => {
    if (!value) return null;
    try {
      return parseLocalDateTimeInput(value, tz);
    } catch {
      return null;
    }
  }, [value, tz]);
  const canReschedule = item?.kind === "publication" && (item.status === "scheduled" || item.status === "held");

  const save = async () => {
    if (!item?.publicationId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ status: string; reason: string | null }>(`/api/publications/${item.publicationId}/reschedule`, { body: { localDateTime: value } });
      toast({ tone: "ok", title: "Termin geändert", text: r.status === "held" ? (r.reason ?? "Wird zurückgehalten.") : undefined });
      onClose();
      setValue("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setValue("");
        setErr(null);
      }}
      title={item?.title ?? ""}
      description={item ? `${item.systemName} · ${DateTime.fromISO(item.at, { zone: tz }).setLocale("de").toFormat("cccc, d. LLLL yyyy, HH:mm")} (${tz})` : undefined}
      footer={
        item && (
          <>
            <Link href={item.kind === "pending" ? `/app/produktion/${item.jobId}` : `/app/freigaben/${item.jobId}`} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-2 hover:bg-surface-3">
              <ExternalLink className="size-4" aria-hidden /> Auftrag öffnen
            </Link>
            {canReschedule && (
              <Button onClick={save} disabled={!resolved || busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} Termin speichern
              </Button>
            )}
          </>
        )
      }
    >
      {item && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FormatTag format={item.format} />
            {item.kind === "publication" ? <PublicationBadge status={item.status} /> : <JobStatusBadge status={item.status as JobStatus} />}
            {item.mode === "simulated" && <DemoTag>simuliert</DemoTag>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.platforms.map((p) => (
              <PlatformChip key={p.platform} platform={p.platform} format={item.format} status={p.status} />
            ))}
          </div>
          {item.kind === "pending" && (
            <InlineAlert tone={item.slotMissed ? "warn" : "info"}>
              {item.slotMissed
                ? "Dieser Termin ist ohne Freigabe verstrichen – es wurde nichts veröffentlicht. Bei der Freigabe wird ein neuer Termin vorgeschlagen."
                : "Noch nicht freigegeben. Ohne deine Freigabe wird zu diesem Termin nichts veröffentlicht."}
            </InlineAlert>
          )}
          {item.heldReason && <InlineAlert tone="warn">{HELD_REASON_DE_CLIENT[item.heldReason] ?? item.heldReason}</InlineAlert>}
          {canReschedule && (
            <>
              <Field label={`Neuer Termin (${tz})`} htmlFor="resched" hint="Kollisionen, vergangene Termine und die Freigabe werden serverseitig geprüft.">
                <Input id="resched" type="datetime-local" value={value} min={toLocalInputValue(new Date(nowIso), tz)} onChange={(e) => setValue(e.target.value)} />
              </Field>
              {resolved?.adjustment && <p className="text-sm text-warn">{adjustmentText[resolved.adjustment]}</p>}
            </>
          )}
          {err && <InlineAlert tone="error">{err}</InlineAlert>}
        </div>
      )}
    </Dialog>
  );
}

function AddSlotDialog({ open, onClose, systems }: { open: boolean; onClose: () => void; systems: Sys[] }) {
  const router = useRouter();
  const toast = useToast();
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const sys = systems.find((s) => s.id === systemId);
  const [format, setFormat] = useState<"longform" | "short">("longform");
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/systems/${systemId}/slots`, { body: { format, weekday, localTime: time } });
      toast({ tone: "ok", title: "Slot ergänzt", text: `${WEEKDAYS_LONG_DE[weekday - 1]}, ${time} Uhr – gilt für neue Zyklen.` });
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Wiederkehrenden Slot ergänzen"
      description="Ergänzt den Uploadplan eines Systems. Kontingente gelten weiterhin."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy || !systemId}>
            {busy && <Loader2 className="size-4 animate-spin" />} Slot speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="System" htmlFor="as-sys" className="sm:col-span-2">
          <Select id="as-sys" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.timezone})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format" htmlFor="as-f">
          <Select id="as-f" value={format} onChange={(e) => setFormat(e.target.value as "longform" | "short")}>
            {sys?.longformEnabled && <option value="longform">Video (Longform)</option>}
            {sys?.shortsEnabled && <option value="short">Short</option>}
          </Select>
        </Field>
        <Field label="Wochentag" htmlFor="as-d">
          <Select id="as-d" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAYS_LONG_DE.map((w, i) => (
              <option key={w} value={i + 1}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Uhrzeit" htmlFor="as-t">
          <Input id="as-t" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {err && <InlineAlert tone="error" className="sm:col-span-2">{err}</InlineAlert>}
      </div>
    </Dialog>
  );
}

function DemoClock({ demo, tz, nowIso }: { demo: { offsetMinutes: number; nextPublicationAt: string | null }; tz: string; nowIso: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (action: "next_publication" | "advance_hours" | "reset", hours?: number) => {
    setBusy(action);
    try {
      await apiFetch("/api/demo/clock", { body: { action, hours } });
      toast({
        tone: "info",
        title: action === "reset" ? "Demo-Uhr zurückgesetzt" : "Demo-Uhr vorgestellt",
        text: action === "reset" ? undefined : "Der Worker verarbeitet fällige Jobs in wenigen Sekunden – ohne Freigabe wird nichts veröffentlicht.",
      });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Nicht möglich", text: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex-1 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-4 text-coral" aria-hidden /> Demo-Zeitsteuerung <DemoTag />
        </p>
        <p className="text-ink-3">
          Demo-Jetzt: {DateTime.fromISO(nowIso, { zone: tz }).setLocale("de").toFormat("ccc, d. LLL, HH:mm")}
          {demo.offsetMinutes ? ` (+${Math.round((demo.offsetMinutes / 60) * 10) / 10} h)` : " (echte Zeit)"}
          {demo.nextPublicationAt && ` · nächste geplante Veröffentlichung ${DateTime.fromISO(demo.nextPublicationAt, { zone: tz }).setLocale("de").toFormat("ccc HH:mm")}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => act("next_publication")} disabled={!!busy || !demo.nextPublicationAt}>
          {busy === "next_publication" ? <Loader2 className="size-4 animate-spin" /> : <FastForward className="size-4" aria-hidden />} Fällige Demo-Jobs ausführen
        </Button>
        <Button size="sm" variant="secondary" onClick={() => act("advance_hours", 24)} disabled={!!busy}>
          +24 h
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act("reset")} disabled={!!busy || demo.offsetMinutes === 0}>
          <RotateCcw className="size-4" aria-hidden /> Zurücksetzen
        </Button>
      </div>
    </div>
  );
}

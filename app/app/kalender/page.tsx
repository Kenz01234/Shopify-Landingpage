import { DateTime } from "luxon";
import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { calendarItems } from "@/lib/publishing";
import { orgNow } from "@/lib/clock";
import { isDemoMode } from "@/lib/env";
import { CalendarView } from "@/components/app/calendar/calendar-view";
import { ListRefresher } from "@/components/app/list-refresher";

export const metadata = { title: "Kalender" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ woche?: string; tz?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: viewer.org.id } });
  const systems = await prisma.channelSystem.findMany({ where: { organizationId: viewer.org.id, status: { not: "archived" } }, orderBy: { createdAt: "asc" } });
  const zones = [...new Set(systems.map((s) => s.timezone))];
  const tz = sp.tz && zones.includes(sp.tz) ? sp.tz : (zones[0] ?? "Europe/Berlin");
  const now = orgNow(org);
  const base = sp.woche && /^\d{4}-\d{2}-\d{2}$/.test(sp.woche) ? DateTime.fromISO(sp.woche, { zone: tz }) : DateTime.fromJSDate(now, { zone: tz });
  const weekStart = base.startOf("week");
  const weekEnd = weekStart.plus({ weeks: 2 });
  const items = await calendarItems(viewer.org.id, weekStart.toUTC().toJSDate(), weekEnd.toUTC().toJSDate());
  const nextPub = await prisma.publication.findFirst({ where: { organizationId: viewer.org.id, status: "scheduled", scheduledAt: { gt: now } }, orderBy: { scheduledAt: "asc" } });

  return (
    <>
      <ListRefresher interval={4000} />
      <PageHeader
        title="Kalender"
        description="Videos und Shorts, geplante und veröffentlichte Termine. Gespeichert in UTC, angezeigt in der Zeitzone des Systems."
      />
      <CalendarView
        tz={tz}
        zones={zones}
        weekStart={weekStart.toISODate()!}
        nowIso={now.toISOString()}
        items={items}
        systems={systems.map((s) => ({ id: s.id, name: s.name, timezone: s.timezone, longformEnabled: s.longformEnabled, shortsEnabled: s.shortsEnabled, status: s.status }))}
        demo={isDemoMode() ? { offsetMinutes: org.demoClockOffsetMinutes, nextPublicationAt: nextPub?.scheduledAt.toISOString() ?? null } : null}
      />
    </>
  );
}

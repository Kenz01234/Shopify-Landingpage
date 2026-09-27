import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { orgNow } from "@/lib/clock";
import { audit } from "@/lib/audit";

/**
 * Demo-Zeitsteuerung (nur Demo-Modus): verschiebt „Jetzt“ für die eigene Organisation,
 * damit fällige Veröffentlichungen, verpasste Slots und Periodenwechsel prüfbar sind.
 * Der Worker verarbeitet fällige Jobs anschließend wie gewohnt.
 */
const schema = z.object({ action: z.enum(["next_publication", "advance_hours", "reset"]), hours: z.number().int().min(1).max(24 * 45).optional() });

export const POST = api(async ({ req, ctx }) => {
  if (!isDemoMode()) throw new AppError("NOT_FOUND", "Nicht gefunden.", 404);
  const body = await parseBody(req, schema);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  let offset = org.demoClockOffsetMinutes;
  if (body.action === "reset") offset = 0;
  if (body.action === "advance_hours") offset += (body.hours ?? 1) * 60;
  if (body.action === "next_publication") {
    const now = orgNow(org);
    const next = await prisma.publication.findFirst({
      where: { organizationId: ctx.orgId, status: "scheduled", scheduledAt: { gt: now } },
      orderBy: { scheduledAt: "asc" },
    });
    if (!next) throw new AppError("NO_PUBLICATION", "Es ist keine zukünftige Veröffentlichung geplant.", 409);
    offset = Math.ceil((next.scheduledAt.getTime() - Date.now()) / 60_000) + 1;
  }
  const saved = await prisma.organization.update({ where: { id: ctx.orgId }, data: { demoClockOffsetMinutes: offset } });
  await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "demo.clock", meta: { action: body.action, offset } });
  return { offsetMinutes: saved.demoClockOffsetMinutes, now: orgNow(saved).toISOString() };
});

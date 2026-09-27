import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { archiveSystem, pauseSystem, resumeSystem } from "@/lib/systems";
import { prisma } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { parseLocalTime } from "@/lib/time";
import { audit } from "@/lib/audit";

const slotSchema = z.object({
  format: z.enum(["longform", "short"]),
  weekday: z.number().int().min(1).max(7),
  localTime: z.string().refine((t) => parseLocalTime(t) !== null, "Uhrzeit im Format HH:MM"),
});

export const POST = api<{ id: string; action: string }>(async ({ req, ctx, params }) => {
  switch (params.action) {
    case "pause":
      return pauseSystem(ctx, params.id);
    case "resume":
      return resumeSystem(ctx, params.id);
    case "archive":
      return archiveSystem(ctx, params.id);
    case "slots": {
      const body = await parseBody(req, slotSchema);
      const system = await prisma.channelSystem.findFirst({ where: { id: params.id, organizationId: ctx.orgId } });
      if (!system) throw notFound("System");
      if (system.status === "archived") throw new AppError("ARCHIVED", "Archiviertes System.", 409);
      if (body.format === "longform" && !system.longformEnabled) throw new AppError("FORMAT_DISABLED", "Longform ist deaktiviert.", 409);
      if (body.format === "short" && !system.shortsEnabled) throw new AppError("FORMAT_DISABLED", "Shorts sind deaktiviert.", 409);
      const exists = await prisma.scheduleSlot.findFirst({ where: { systemId: system.id, ...body } });
      if (exists) throw new AppError("DUPLICATE", "Diesen Slot gibt es bereits.", 409);
      await prisma.$transaction([
        prisma.scheduleSlot.create({ data: { organizationId: ctx.orgId, systemId: system.id, ...body } }),
        prisma.channelSystem.update({ where: { id: system.id }, data: { configVersion: { increment: 1 } } }),
      ]);
      await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "system.slot_add", targetType: "system", targetId: system.id, meta: body });
      return { ok: true };
    }
    default:
      throw notFound("Aktion");
  }
});

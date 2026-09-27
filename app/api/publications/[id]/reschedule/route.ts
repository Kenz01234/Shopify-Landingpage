import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notFound, AppError } from "@/lib/errors";
import { reschedulePublication } from "@/lib/publishing";
import { parseLocalDateTimeInput, type SlotAdjustment } from "@/lib/time";

/** Termin ändern: entweder UTC-Zeitpunkt (aus Slot-Liste) oder lokale Eingabe in der Systemzeitzone. */
const schema = z.union([z.object({ at: z.string().datetime() }), z.object({ localDateTime: z.string().min(16).max(16) })]);

export const POST = api<{ id: string }>(async ({ req, ctx, params }) => {
  const body = await parseBody(req, schema);
  const pub = await prisma.publication.findFirst({ where: { id: params.id, organizationId: ctx.orgId }, include: { system: true } });
  if (!pub) throw notFound("Veröffentlichung");
  let at: Date;
  let adjustment: SlotAdjustment = null;
  if ("at" in body) at = new Date(body.at);
  else {
    try {
      const r = parseLocalDateTimeInput(body.localDateTime, pub.system.timezone);
      at = r.utc;
      adjustment = r.adjustment;
    } catch {
      throw new AppError("INVALID_DATE", "Ungültiges Datum.", 422);
    }
  }
  const r = await reschedulePublication(ctx, params.id, at, adjustment);
  return { ...r, at: at.toISOString(), adjustment };
});

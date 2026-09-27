import { api } from "@/lib/api";
import { calendarItems } from "@/lib/publishing";
import { AppError } from "@/lib/errors";

export const GET = api(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const from = new Date(u.searchParams.get("from") ?? "");
  const to = new Date(u.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 62 * 86400000) {
    throw new AppError("INVALID_RANGE", "Ungültiger Zeitraum.", 422);
  }
  return { items: await calendarItems(ctx.orgId, from, to) };
});

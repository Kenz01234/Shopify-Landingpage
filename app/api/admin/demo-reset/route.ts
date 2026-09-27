import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { isDemoMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { resetDemoData } from "@/lib/demo/seed";
import { prisma } from "@/lib/db";

/** Admin: Demo-Szenario zurücksetzen – nur im Demo-Modus und nur mit ausdrücklicher Bestätigung. */
export const POST = api(
  async ({ req, ctx }) => {
    if (!isDemoMode()) throw new AppError("NOT_DEMO", "Nur im lokalen Demo-Modus verfügbar.", 400);
    const { confirm } = await parseBody(req, z.object({ confirm: z.string() }));
    if (confirm !== "ZURÜCKSETZEN") throw new AppError("CONFIRM", "Bitte zur Bestätigung ZURÜCKSETZEN eintippen.", 422);
    await prisma.auditEvent.create({ data: { actorType: "admin", actorUserId: ctx.userId, action: "demo.reset" } });
    await resetDemoData();
    return { ok: true, relogin: true };
  },
  { admin: true },
);

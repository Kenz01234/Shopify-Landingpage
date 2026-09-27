import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { saveWizardDraft } from "@/lib/systems";

export const GET = api(async ({ ctx }) => {
  const d = await prisma.wizardDraft.findUnique({ where: { organizationId_userId: { organizationId: ctx.orgId, userId: ctx.userId } } });
  return { draft: d ? { step: d.step, data: d.data, updatedAt: d.updatedAt } : null };
});

export const PUT = api(async ({ req, ctx }) => {
  const body = await parseBody(req, z.object({ step: z.number().int().min(1).max(7), data: z.record(z.string(), z.unknown()) }));
  const d = await saveWizardDraft(ctx, body.step, body.data);
  return { updatedAt: d.updatedAt };
});

export const DELETE = api(async ({ ctx }) => {
  await prisma.wizardDraft.deleteMany({ where: { organizationId: ctx.orgId, userId: ctx.userId } });
  return { ok: true };
});

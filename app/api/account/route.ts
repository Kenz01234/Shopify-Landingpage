import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  organizationName: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
});

export const PATCH = api(async ({ req, ctx, viewer }) => {
  const body = await parseBody(req, schema);
  await prisma.$transaction([
    prisma.user.update({ where: { id: ctx.userId }, data: { name: body.name } }),
    ...(viewer.role === "owner" ? [prisma.organization.update({ where: { id: ctx.orgId }, data: { name: body.organizationName } })] : []),
  ]);
  await audit(prisma, { orgId: ctx.orgId, actor: { type: "user", userId: ctx.userId }, action: "account.update" });
  return { ok: true };
});

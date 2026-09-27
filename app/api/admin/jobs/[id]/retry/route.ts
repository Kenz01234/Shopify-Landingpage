import { api } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { retryJob } from "@/lib/jobs/service";

/** Admin: fehlgeschlagenen Auftrag kontrolliert wiederholen (Rolle serverseitig geprüft). */
export const POST = api<{ id: string }>(
  async ({ ctx, params }) => {
    const job = await prisma.productionJob.findUnique({ where: { id: params.id }, select: { organizationId: true } });
    if (!job) throw notFound("Auftrag");
    await retryJob({ orgId: job.organizationId, userId: ctx.userId, actor: { type: "admin", userId: ctx.userId } }, params.id);
    return { ok: true };
  },
  { admin: true },
);

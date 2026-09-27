import { api } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";

/** Status eines Auftrags (für Live-Fortschritt im Kundenbereich). */
export const GET = api<{ id: string }>(async ({ ctx, params }) => {
  const job = await prisma.productionJob.findFirst({
    where: { id: params.id, organizationId: ctx.orgId },
    select: {
      id: true,
      status: true,
      retryStep: true,
      attempt: true,
      maxAttempts: true,
      lastErrorMessage: true,
      nextRunAt: true,
      updatedAt: true,
      currentVersionId: true,
      events: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, message: true, kind: true, toStatus: true, createdAt: true } },
    },
  });
  if (!job) throw notFound("Auftrag");
  return job;
});

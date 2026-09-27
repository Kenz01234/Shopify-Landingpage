import type { Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type Actor = { type: "user" | "system" | "worker" | "admin" | "webhook"; userId?: string | null };

export async function audit(
  db: Db,
  params: {
    orgId?: string | null;
    actor: Actor;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
  },
) {
  await db.auditEvent.create({
    data: {
      organizationId: params.orgId ?? null,
      actorType: params.actor.type,
      actorUserId: params.actor.userId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      meta: (params.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}

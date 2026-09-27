import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type Viewer = {
  user: { id: string; name: string; email: string; platformRole: "customer" | "admin"; isDemo: boolean };
  org: { id: string; name: string; isDemo: boolean; demoClockOffsetMinutes: number };
  role: "owner" | "member";
};

/** Liefert die angemeldete Person inkl. Organisation – serverseitig aus der Session-Tabelle. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { include: { organization: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const m = user?.memberships[0];
  if (!user || !m) return null;
  return {
    user: { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole, isDemo: user.isDemo },
    org: { id: m.organization.id, name: m.organization.name, isDemo: m.organization.isDemo, demoClockOffsetMinutes: m.organization.demoClockOffsetMinutes },
    role: m.role,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** Admin-Bereich: serverseitige Rollenprüfung. Unberechtigte sehen eine 404 statt eines versteckten Menüs. */
export async function requireAdmin(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.user.platformRole !== "admin") notFound();
  return v;
}

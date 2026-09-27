import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { SystemWizard } from "@/components/app/wizard/system-wizard";
import { DiscardDraftButton } from "@/components/app/system-actions";
import { allocationUsedByOthers } from "@/lib/systems";
import type { SystemInput } from "@/lib/validation/system";
import { CreditCard } from "lucide-react";

export const metadata = { title: "Neues System" };

export default async function NewSystemPage() {
  const viewer = await requireViewer();
  const sub = await prisma.subscription.findUnique({ where: { organizationId: viewer.org.id } });
  if (!sub || sub.status === "canceled") {
    return (
      <>
        <PageHeader title="Neues System erstellen" back={{ href: "/app/systeme", label: "Systeme" }} />
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="Zuerst einen Plan wählen"
          text="Deine Mengen (Videos, Shorts, Länge) richten sich nach dem Plan. Im Demo-Modus wird dabei nichts abgebucht."
          action={<ButtonLink href="/app/abo?weiter=wizard">Plan wählen</ButtonLink>}
        />
      </>
    );
  }
  const [draft, used] = await Promise.all([
    prisma.wizardDraft.findUnique({ where: { organizationId_userId: { organizationId: viewer.org.id, userId: viewer.user.id } } }),
    allocationUsedByOthers(prisma, viewer.org.id),
  ]);
  return (
    <>
      <PageHeader
        title="Neues System erstellen"
        description="In sieben kurzen Schritten zu deinem eigenen Faceless-Loop. Dein Zwischenstand wird automatisch gespeichert."
        back={{ href: "/app/systeme", label: "Systeme" }}
        actions={
          draft ? <DiscardDraftButton /> : undefined
        }
      />
      <SystemWizard
        key={draft ? draft.updatedAt.toISOString() : "leer"}
        mode="create"
        plan={sub.plan}
        usedByOthers={used}
        draft={draft ? { step: draft.step, data: draft.data as Partial<SystemInput>, updatedAt: draft.updatedAt.toISOString() } : null}
      />
    </>
  );
}

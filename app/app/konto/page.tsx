import { requireViewer } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { AccountForms } from "@/components/app/account-forms";

export const metadata = { title: "Konto" };

export default async function AccountPage() {
  const viewer = await requireViewer();
  const sessions = await prisma.session.count({ where: { userId: viewer.user.id, expiresAt: { gt: new Date() } } });
  return (
    <>
      <PageHeader title="Konto" description="Profil, Organisation und Anmeldung. Änderungen werden sofort gespeichert und bleiben nach dem Neuladen erhalten." />
      <AccountForms
        name={viewer.user.name}
        email={viewer.user.email}
        orgName={viewer.org.name}
        isOwner={viewer.role === "owner"}
        isDemo={viewer.user.isDemo}
        sessions={sessions}
      />
    </>
  );
}

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { getAlertsCount } from "@/lib/dashboard-stats";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const fullName = session.user.name ?? "مستخدم";
  const roleLabel = ROLE_LABELS_AR[session.user.role];
  const alertsCount = await getAlertsCount(session.user);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar fullName={fullName} roleLabel={roleLabel} role={session.user.role} />
      <div className="flex flex-1 flex-col">
        <TopBar fullName={fullName} alertsCount={alertsCount} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

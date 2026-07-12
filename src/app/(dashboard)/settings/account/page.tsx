import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">حسابي</h1>
        <p className="text-sm text-foreground/60">
          {session.user.name} · {ROLE_LABELS_AR[session.user.role]}
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-navy">تغيير كلمة المرور</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}

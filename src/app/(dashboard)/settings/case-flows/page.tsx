import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagement } from "@/lib/rbac";
import { CaseFlowsManager } from "./CaseFlowsManager";

export default async function CaseFlowsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!isManagement(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        هذه الصفحة متاحة للشركاء والمحامين الأوائل فقط.
      </div>
    );
  }

  const stages = await prisma.caseFlowStage.findMany({
    orderBy: [{ caseType: "asc" }, { order: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">إدارة مسارات القضايا</h1>
        <p className="text-sm text-foreground/60">
          عدّل مراحل المسار القضائي لكل نوع قضية دون الحاجة لمبرمج — يظهر أي تعديل هنا فورًا في
          شريط مسار القضية وفي التحقق من إلزامية رفع الدعوى.
        </p>
      </div>

      <CaseFlowsManager initialStages={stages} />
    </div>
  );
}

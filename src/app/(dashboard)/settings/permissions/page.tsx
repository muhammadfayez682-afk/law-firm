import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canManageUsers } from "@/lib/rbac";
import { PermissionsView } from "./PermissionsView";

export default async function PermissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  // نفس بوّابة صفحة المستخدمين: مسؤول النظام فقط.
  if (!canManageUsers(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        صلاحية الاطّلاع على مصفوفة الصلاحيات متاحة لمسؤول النظام فقط.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">مصفوفة الصلاحيات</h1>
        <p className="mt-1 text-sm text-foreground/60">
          عرض للقراءة فقط لصلاحيات كل دور كما هي مُنفَّذة في النظام (مصدرها ملف الصلاحيات المركزي).
        </p>
      </div>

      {/* ملاحظة توضيحية */}
      <div className="rounded-xl border border-taradhi/15 bg-taradhi/[0.04] p-4 text-sm leading-relaxed text-navy/80">
        <p>
          هذه الصلاحيات <strong>معرّفة في النظام</strong> وتطابق منطق التحكّم الفعلي. الرؤية{" "}
          <strong>على مستوى القضية (🗂️)</strong> تعني «قضايا الدور فقط عبر عضوية الفريق أو كونه المحامي المسؤول — لا كل القضايا»؛
          ومسؤول النظام وحده يرى كل القضايا. و<strong>المنع الصريح (DENY) يتفوّق دائمًا</strong> — حتى على عضوية الفريق والتفويض
          (حمايةً لتعارض المصالح). الشاشة للاطّلاع فقط ولا تُعدّل أي صلاحية.
        </p>
      </div>

      <PermissionsView />
    </div>
  );
}

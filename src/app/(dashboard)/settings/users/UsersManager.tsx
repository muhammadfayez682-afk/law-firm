"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";

type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  activeCases: number;
};

const ROLE_OPTIONS: UserRole[] = ["partner", "senior_lawyer", "lawyer", "secretary", "accountant"];

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [disableUser, setDisableUser] = useState<ManagedUser | null>(null);
  const router = useRouter();

  const activeOwners = initialUsers.filter(
    (u) => u.isActive && ["partner", "senior_lawyer", "lawyer"].includes(u.role)
  );

  async function toggleActive(user: ManagedUser) {
    if (!user.isActive) {
      // إعادة تفعيل مباشرة.
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر تفعيل الحساب.");
        return;
      }
      toast.success("تم تفعيل الحساب");
      router.refresh();
      return;
    }
    // تعطيل: افتح نافذة تأكيد (قد تتطلب نقل قضايا).
    setDisableUser(user);
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + مستخدم جديد
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">البريد</th>
                <th className="px-4 py-3">الجوال</th>
                <th className="px-4 py-3">الدور</th>
                <th className="px-4 py-3">قضايا نشطة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">تاريخ الإضافة</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3 font-medium text-navy">{u.fullName}</td>
                  <td className="px-4 py-3 text-foreground/70" dir="ltr">
                    {u.email}
                  </td>
                  <td className="px-4 py-3 text-foreground/70" dir="ltr">
                    {u.phone ? toEnglishDigits(u.phone) : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{ROLE_LABELS_AR[u.role]}</td>
                  <td className="px-4 py-3 text-foreground/70">{toEnglishDigits(u.activeCases)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.isActive ? "نشط" : "معطّل"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {formatDualDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="rounded-lg border border-navy/20 px-2.5 py-1 font-medium text-navy hover:bg-navy/5"
                      >
                        تعديل
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          className={`rounded-lg border px-2.5 py-1 font-medium ${
                            u.isActive
                              ? "border-red-300 text-red-600 hover:bg-red-50"
                              : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {u.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewUserModal onClose={() => setShowNew(false)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {disableUser && (
        <DisableUserModal
          user={disableUser}
          reassignTargets={activeOwners.filter((o) => o.id !== disableUser.id)}
          onClose={() => setDisableUser(null)}
        />
      )}
    </>
  );
}

function NewUserModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || null,
      role: formData.get("role"),
      password: formData.get("password") || null,
    };
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر إنشاء المستخدم.");
        return;
      }
      toast.success(`تم إنشاء المستخدم. كلمة المرور المؤقتة: ${data.tempPassword}`, {
        duration: 12000,
      });
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="مستخدم جديد" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>الاسم الكامل</label>
          <input name="fullName" required className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>البريد الإلكتروني</label>
            <input name="email" type="email" required className={inputClass} dir="ltr" />
          </div>
          <div>
            <label className={labelClass}>الجوال</label>
            <input name="phone" className={inputClass} dir="ltr" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>الدور</label>
            <select name="role" defaultValue="lawyer" className={inputClass}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_AR[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>كلمة مرور مؤقتة</label>
            <input
              name="password"
              className={inputClass}
              dir="ltr"
              placeholder="اتركها فارغة للتوليد التلقائي"
            />
          </div>
        </div>
        <ModalActions loading={loading} submitLabel="إنشاء المستخدم" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function EditUserModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") || "");
    const payload = {
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || null,
      role: formData.get("role"),
      ...(password ? { password } : {}),
    };
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر حفظ التعديلات.");
        return;
      }
      toast.success("تم حفظ التعديلات");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`تعديل: ${user.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>الاسم الكامل</label>
          <input name="fullName" defaultValue={user.fullName} required className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>الجوال</label>
            <input name="phone" defaultValue={user.phone ?? ""} className={inputClass} dir="ltr" />
          </div>
          <div>
            <label className={labelClass}>الدور</label>
            <select name="role" defaultValue={user.role} className={inputClass}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_AR[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>إعادة تعيين كلمة المرور</label>
          <input
            name="password"
            className={inputClass}
            dir="ltr"
            placeholder="اتركها فارغة للإبقاء على الحالية"
          />
        </div>
        <ModalActions loading={loading} submitLabel="حفظ التعديلات" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function DisableUserModal({
  user,
  reassignTargets,
  onClose,
}: {
  user: ManagedUser;
  reassignTargets: ManagedUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reassignToId, setReassignToId] = useState("");
  const hasActiveCases = user.activeCases > 0;

  async function submit(force: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: false,
          ...(reassignToId ? { reassignToId } : {}),
          ...(force ? { force: true } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تعطيل الحساب.");
        return;
      }
      toast.success("تم تعطيل الحساب");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`تعطيل حساب: ${user.fullName}`} onClose={onClose}>
      <div className="space-y-4">
        {hasActiveCases ? (
          <>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              لدى هذا المستخدم {toEnglishDigits(user.activeCases)} قضية نشطة. اختر محاميًا لنقل قضاياه
              إليه، أو عطّل الحساب مع إبقاء القضايا مسندة إليه.
            </div>
            <div>
              <label className={labelClass}>نقل القضايا النشطة إلى</label>
              <select
                value={reassignToId}
                onChange={(e) => setReassignToId(e.target.value)}
                className={inputClass}
              >
                <option value="">— بدون نقل —</option>
                {reassignTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({ROLE_LABELS_AR[t.role]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => submit(!reassignToId)}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading
                  ? "جارٍ..."
                  : reassignToId
                    ? "نقل القضايا وتعطيل الحساب"
                    : "تعطيل مع إبقاء القضايا"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground/70">
              سيتم تعطيل الحساب ولن يتمكّن المستخدم من تسجيل الدخول. يُحفظ سجله وقضاياه.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => submit(false)}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? "جارٍ..." : "تعطيل الحساب"}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  loading,
  submitLabel,
  onClose,
}: {
  loading: boolean;
  submitLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
      >
        إلغاء
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {loading ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </div>
  );
}

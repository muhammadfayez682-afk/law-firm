"use client";

// تفويض الصلاحيات على مستوى القضية — جدول التفويضات الفعّالة + مودال منح تفويض.
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { DelegatedPermission } from "@prisma/client";
import { DELEGATED_PERMISSION_LABELS_AR, DELEGATION_DEFAULT_EXPIRY_DAYS } from "@/lib/caseDelegation";
import { formatDualDate } from "@/lib/dateUtils";

export type DelegationView = {
  id: string;
  permissionLabel: string;
  grantedToName: string;
  grantedById: string;
  grantedByName: string;
  expiresAt: string;
  isEffective: boolean;
  granterLostPermission: boolean;
};

export type DelegationCandidate = { id: string; fullName: string; role: string };

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

export function CaseDelegationsPanel({
  caseId,
  caseTitle,
  delegations,
  candidates,
  grants,
  currentUserId,
  canManage,
}: {
  caseId: string;
  caseTitle: string;
  delegations: DelegationView[];
  candidates: DelegationCandidate[]; // من يجوز التفويض إليهم (أدنى في السلسلة)
  grants: DelegatedPermission[]; // الصلاحيات التي يملكها المستخدم ويمكنه تفويضها
  currentUserId: string;
  canManage: boolean; // مسؤول نظام/مشرف — يمكنه إلغاء أي تفويض
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const canGrant = grants.length > 0 && candidates.length > 0;

  async function revoke(delegationId: string) {
    const res = await fetch(`/api/cases/${caseId}/delegations/${delegationId}`, { method: "PATCH" });
    const d = await res.json().catch(() => null);
    if (!res.ok) return toast.error(d?.error ?? "تعذّر الإلغاء");
    toast.success("أُلغي التفويض");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">🔑 تفويض الصلاحيات</h2>
        {canGrant && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg border border-navy/20 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/5"
          >
            + منح تفويض
          </button>
        )}
      </div>

      {delegations.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد تفويضات على هذه القضية</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {delegations.map((d) => {
            const canRevoke = canManage || d.grantedById === currentUserId;
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-navy">
                    {d.grantedToName} — {d.permissionLabel}
                  </p>
                  <p className="text-xs text-foreground/50">
                    من {d.grantedByName} · تنتهي {formatDualDate(d.expiresAt)}
                    {d.granterLostPermission && (
                      <span className="text-red-600"> · مُعطّل (فقد المُفوِّض الصلاحية)</span>
                    )}
                  </p>
                </div>
                {canRevoke && (
                  <button
                    type="button"
                    onClick={() => revoke(d.id)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    إلغاء
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && (
        <GrantModal
          caseId={caseId}
          caseTitle={caseTitle}
          candidates={candidates}
          grants={grants}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}

function GrantModal({
  caseId,
  caseTitle,
  candidates,
  grants,
  onClose,
}: {
  caseId: string;
  caseTitle: string;
  candidates: DelegationCandidate[];
  grants: DelegatedPermission[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [grantedToId, setGrantedToId] = useState("");
  const [permission, setPermission] = useState<DelegatedPermission | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!grantedToId || !permission) return toast.error("اختر العضو والصلاحية");
    if (!reason.trim()) return toast.error("سبب التفويض إلزامي");
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantedToId,
          permission,
          expiresAt: expiresAt || null,
          reason: reason.trim(),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.error ?? "تعذّر منح التفويض");
      toast.success("مُنح التفويض");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-lg font-bold text-navy">منح تفويض — {caseTitle}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">العضو <span className="text-red-600">*</span></label>
            <select value={grantedToId} onChange={(e) => setGrantedToId(e.target.value)} className={inputClass}>
              <option value="">اختر عضوًا من الفريق</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">الصلاحية <span className="text-red-600">*</span></label>
            <select value={permission} onChange={(e) => setPermission(e.target.value as DelegatedPermission)} className={inputClass}>
              <option value="">اختر الصلاحية</option>
              {grants.map((p) => (
                <option key={p} value={p}>{DELEGATED_PERMISSION_LABELS_AR[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">تاريخ الانتهاء (اختياري)</label>
            <input type="date" dir="ltr" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-foreground/50">افتراضيًا {DELEGATION_DEFAULT_EXPIRY_DAYS} يومًا من الآن.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">سبب التفويض <span className="text-red-600">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
          </div>

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button
              type="button"
              disabled={busy || !grantedToId || !permission || !reason.trim()}
              onClick={submit}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {busy ? "جارٍ المنح..." : "منح التفويض"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

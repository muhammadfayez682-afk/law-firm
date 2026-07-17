"use client";

import Link from "next/link";
import type { DuplicateMatch, DuplicateType } from "@/lib/duplicateCheck";

const TYPE_LABELS: Record<DuplicateType, string> = {
  phone: "رقم الجوال",
  national_id: "رقم الهوية/السجل",
  agency_number: "رقم الوكالة",
};

/**
 * مودال التحذير عند اكتشاف تكرار (استجابة 409).
 * - «استخدام السجل الموجود» يظهر فقط عند وجود سجل عميل قابل للربط.
 * - «متابعة الحفظ» يعيد الإرسال بـ force=true.
 */
export function DuplicateWarningModal({
  type,
  value,
  existingIn,
  onUseExisting,
  onContinue,
  onCancel,
  busy = false,
}: {
  type: DuplicateType;
  value: string;
  existingIn: DuplicateMatch[];
  onUseExisting?: (match: DuplicateMatch) => void;
  onContinue: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const clientMatch = existingIn.find((m) => m.entity === "client" || m.clientId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-black/5 bg-amber-50 px-5 py-4">
          <span className="text-xl">⚠️</span>
          <h2 className="font-amiri text-lg font-bold text-amber-900">تم اكتشاف تكرار</h2>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-foreground/80">
            {TYPE_LABELS[type]} <span className="font-mono font-semibold" dir="ltr">{value}</span> مسجّل مسبقًا:
          </p>

          <ul className="space-y-2">
            {existingIn.map((m) => (
              <li key={`${m.entity}-${m.id}`} className="rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2 text-sm">
                <p className="font-medium text-navy">{m.name}</p>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-foreground/50">{m.context}</span>
                  {m.href && (
                    <Link href={m.href} target="_blank" className="text-xs text-taradhi hover:underline">
                      عرض ←
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-black/5 pt-3">
            <p className="mb-3 text-sm font-medium text-navy">هل هذا نفس الشخص؟</p>
            <div className="space-y-2">
              {onUseExisting && clientMatch && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUseExisting(clientMatch)}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  استخدام السجل الموجود ✓
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={onContinue}
                className="w-full rounded-lg border border-navy/30 px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-60"
              >
                {busy ? "جارٍ الحفظ..." : "متابعة الحفظ (تسجيل جديد)"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="w-full rounded-lg px-4 py-2 text-sm text-foreground/60 hover:bg-black/5 disabled:opacity-60"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

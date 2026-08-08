"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { DashboardWidgetMeta, DashboardWidgetId } from "@/lib/dashboardWidgets";

export function DashboardCustomizer({
  widgets,
  visible,
}: {
  widgets: readonly DashboardWidgetMeta[];
  visible: DashboardWidgetId[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<DashboardWidgetId>>(new Set(visible));
  const [saving, setSaving] = useState(false);

  function toggle(id: DashboardWidgetId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openModal() {
    setSelected(new Set(visible)); // إعادة المزامنة مع المحفوظ عند كل فتح
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleWidgets: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      toast.success("حُفظت تفضيلات اللوحة");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("تعذّر حفظ التفضيلات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
      >
        ⚙️ تخصيص اللوحة
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-amiri text-lg font-bold text-navy">تخصيص لوحة التحكم</h2>
            <p className="mb-4 text-sm text-foreground/60">اختر الودجتات التي تريد إظهارها.</p>

            <div className="space-y-2">
              {widgets.map((w) => {
                const checked = selected.has(w.id);
                return (
                  <label
                    key={w.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      checked ? "border-gold/40 bg-gold/5" : "border-black/10 hover:bg-black/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(w.id)}
                      className="mt-0.5 h-4 w-4 accent-gold"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-navy">{w.label}</span>
                      <span className="block text-xs text-foreground/50">{w.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

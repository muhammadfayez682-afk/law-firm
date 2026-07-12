"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { passwordStrengthError } from "@/lib/validators";

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      toast.error("تأكيد كلمة المرور لا يطابق الجديدة");
      return;
    }
    const strength = passwordStrengthError(form.next);
    if (strength) {
      toast.error(strength);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تغيير كلمة المرور.");
        return;
      }
      toast.success("تم تغيير كلمة المرور — سيُطلب تسجيل الدخول من جديد");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md space-y-4 rounded-xl border border-black/5 bg-white p-6 shadow-sm"
    >
      <div>
        <label className={labelClass}>كلمة المرور الحالية</label>
        <input
          type="password"
          value={form.current}
          onChange={(e) => update("current", e.target.value)}
          required
          className={inputClass}
          dir="ltr"
        />
      </div>
      <div>
        <label className={labelClass}>كلمة المرور الجديدة</label>
        <input
          type="password"
          value={form.next}
          onChange={(e) => update("next", e.target.value)}
          required
          className={inputClass}
          dir="ltr"
        />
        <p className="mt-1 text-xs text-foreground/50">
          8 أحرف على الأقل، مع حرف كبير وصغير ورقم.
        </p>
      </div>
      <div>
        <label className={labelClass}>تأكيد كلمة المرور الجديدة</label>
        <input
          type="password"
          value={form.confirm}
          onChange={(e) => update("confirm", e.target.value)}
          required
          className={inputClass}
          dir="ltr"
        />
      </div>
      <div className="flex justify-end border-t border-black/5 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {loading ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
        </button>
      </div>
    </form>
  );
}

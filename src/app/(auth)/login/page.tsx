"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";

/* أيقونات مضمّنة (بلا مكتبة خارجية — كنمط بقية المشروع) */
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.7 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a15.6 15.6 0 0 1-3 3.6M6.3 7.6A15.7 15.7 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const fieldClass =
    "w-full rounded-xl border border-black/10 bg-white py-3 text-sm text-navy shadow-sm outline-none transition-all placeholder:text-foreground/30 focus:border-gold focus:ring-2 focus:ring-gold/20";
  const labelClass = "mb-1.5 block text-sm font-medium text-navy";

  return (
    <div className="flex min-h-screen w-full flex-col lg:grid lg:grid-cols-2">
      {/* ===== الجانب البصري (الهوية) — يمين على الديسكتوب، ترويسة علوية على الجوال ===== */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-navy px-6 py-10 text-center lg:py-0">
        {/* علامة مائية خافتة مستوحاة من تناظر الميزان في الشعار */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Image
            src={BRAND.logoDark}
            alt=""
            width={520}
            height={542}
            className="w-[170%] max-w-none opacity-[0.03] blur-[2px] lg:w-[95%]"
          />
        </div>
        {/* توهّج ذهبي ناعم خلف الشعار */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(198,168,103,0.16), transparent)" }}
        />

        <div className="relative z-10 flex flex-col items-center gap-4 lg:gap-6">
          <Image
            src={BRAND.logoDark}
            alt={BRAND.name}
            width={520}
            height={542}
            priority
            className="h-20 w-auto object-contain drop-shadow-lg sm:h-24 lg:h-44"
          />
          <div className="flex flex-col items-center gap-2.5">
            <h1 className="font-amiri text-2xl font-bold text-gold-light lg:text-4xl">{BRAND.name}</h1>
            <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold to-transparent" />
            <p className="max-w-xs text-xs leading-relaxed text-white/55 lg:text-sm">{BRAND.fullName}</p>
            <p className="mt-1 text-[11px] tracking-widest text-gold-light/70 lg:text-xs">{BRAND.tagline}</p>
          </div>
        </div>
      </section>

      {/* ===== جانب النموذج — يسار على الديسكتوب، أسفل على الجوال ===== */}
      <section className="flex flex-1 items-center justify-center bg-white px-6 py-12 lg:py-0">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-amiri text-2xl font-bold text-navy">تسجيل الدخول</h2>
            <p className="mt-1.5 text-sm text-foreground/55">أدخل بياناتك للوصول إلى نظام إدارة المكتب</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* البريد الإلكتروني */}
            <div>
              <label htmlFor="email" className={labelClass}>البريد الإلكتروني</label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/30" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${fieldClass} pl-11 pr-4`}
                  placeholder="name@qudum.sa"
                  dir="ltr"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <label htmlFor="password" className={labelClass}>كلمة المرور</label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/30" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldClass} pl-11 pr-11`}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-navy/40 transition-colors hover:bg-black/5 hover:text-navy"
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-2 text-left">
                <span
                  title="ستتوفّر قريبًا"
                  className="cursor-not-allowed text-xs text-foreground/35"
                >
                  نسيت كلمة المرور؟
                </span>
              </div>
            </div>

            {/* رسالة الخطأ */}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertIcon className="h-5 w-5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-light hover:shadow-md focus:outline-none focus:ring-2 focus:ring-navy/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4" />
                  جارٍ تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[11px] leading-relaxed text-foreground/35">
            {BRAND.fullName}
          </p>
        </div>
      </section>
    </div>
  );
}

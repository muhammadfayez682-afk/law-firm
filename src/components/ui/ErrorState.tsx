"use client";

import { useEffect } from "react";

export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 px-6 py-12 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 text-red-500">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="font-semibold text-red-700">حدث خطأ أثناء تحميل هذه الصفحة</p>
      <p className="max-w-md text-sm text-red-600/80">
        الرجاء المحاولة مرة أخرى، وإن استمرت المشكلة تواصل مع الدعم الفني.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

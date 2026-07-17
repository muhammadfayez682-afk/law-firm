"use client";

import { useState } from "react";
import {
  getAllCaseNumbers,
  getPrimaryCaseNumber,
  type CaseNumberSource,
  type CaseWithNumbers,
} from "@/lib/caseNumber";
import { toEnglishDigits } from "@/lib/formatNumber";

/** شارة لونية لكل مصدر رقم: محكمة أخضر · تسوية أزرق · داخلي رمادي. */
const SOURCE_BADGE_STYLE: Record<CaseNumberSource, string> = {
  court: "bg-emerald-100 text-emerald-700",
  qiwa: "bg-blue-100 text-blue-700",
  taradhi: "bg-blue-100 text-blue-700",
  internal: "bg-gray-100 text-gray-600",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // نسخ متعذّر (سياق غير آمن) — نتجاهل بصمت.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs text-foreground/60 hover:bg-navy/5"
      title="نسخ الرقم"
    >
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

export function CaseNumberDisplay({
  case: caseData,
  variant = "inline",
}: {
  case: CaseWithNumbers;
  variant?: "inline" | "card" | "detailed";
}) {
  const primary = getPrimaryCaseNumber(caseData);

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_BADGE_STYLE[primary.source]}`}
        >
          {primary.label}
        </span>
        <span className="font-medium text-navy" dir="ltr">
          {toEnglishDigits(primary.number)}
        </span>
      </span>
    );
  }

  const all = getAllCaseNumbers(caseData);

  if (variant === "card") {
    const secondary = all.filter((n) => n.value !== primary.number);
    return (
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-foreground/50">{primary.label}</p>
            <p className="mt-0.5 font-amiri text-lg font-bold text-navy" dir="ltr">
              {toEnglishDigits(primary.number)}
            </p>
          </div>
          <CopyButton value={primary.number} />
        </div>
        {secondary.length > 0 && (
          <div className="mt-3 border-t border-black/5 pt-2">
            {secondary.map((n) => (
              <p key={n.label} className="text-xs text-foreground/50">
                {n.label}:{" "}
                <span className="text-foreground/70" dir="ltr">
                  {toEnglishDigits(n.value)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // variant === "detailed"
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-black/5 bg-navy/5 text-xs text-foreground/50">
            <th className="px-4 py-2 font-medium">النوع</th>
            <th className="px-4 py-2 font-medium">الرقم</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {all.map((n) => {
            const isPrimary = n.value === primary.number;
            return (
              <tr key={n.label} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-foreground/70">{n.label}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-navy" dir="ltr">
                    {toEnglishDigits(n.value)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isPrimary && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                      الرقم الرئيسي
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import type { CaseStatus } from "@prisma/client";

const STATUS_CONFIG: Record<CaseStatus, { label: string; className: string }> = {
  intake: { label: "استقبال", className: "bg-slate-100 text-slate-700" },
  pending_agency: { label: "قيد إصدار الوكالة", className: "bg-yellow-100 text-yellow-800" },
  amicable_settlement: { label: "تراضٍ", className: "bg-taradhi/10 text-taradhi" },
  settled_amicably: { label: "تمت التسوية وديًا", className: "bg-emerald-100 text-emerald-700" },
  open: { label: "مفتوحة", className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "قيد النظر", className: "bg-amber-100 text-amber-700" },
  on_hold: { label: "معلّقة", className: "bg-gray-200 text-gray-700" },
  ruled_first_instance: { label: "حُكم ابتدائي", className: "bg-purple-100 text-purple-700" },
  appealed: { label: "مستأنفة", className: "bg-orange-100 text-orange-700" },
  pending_closure: { label: "بانتظار اعتماد الإغلاق", className: "bg-amber-100 text-amber-800" },
  closed: { label: "مغلقة", className: "bg-emerald-100 text-emerald-700" },
  archived: { label: "مؤرشفة", className: "bg-gray-100 text-gray-500" },
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

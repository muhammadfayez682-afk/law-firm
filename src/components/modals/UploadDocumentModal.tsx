"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { DocumentVisibility } from "@prisma/client";

const VISIBILITY_OPTIONS: { value: DocumentVisibility; label: string }[] = [
  { value: "case_team", label: "فريق القضية فقط" },
  { value: "partners_only", label: "مسؤول النظام فقط" },
  { value: "all_staff", label: "جميع الموظفين" },
];

export function UploadDocumentModal({
  caseId,
  onClose,
}: {
  caseId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectFile(selected: File | null) {
    setFile(selected);
    if (selected && !documentName) {
      setDocumentName(selected.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("الرجاء اختيار ملف أو سحبه إلى منطقة الرفع.");
      return;
    }
    if (!documentName.trim()) {
      setError("الرجاء إدخال اسم المستند.");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("caseId", caseId);
    uploadData.append("documentName", documentName.trim());
    uploadData.append("visibilityLevel", String(formData.get("visibilityLevel")));

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر رفع المستند.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تم رفع المستند بنجاح");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">رفع مستند</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">الملف</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                isDragging
                  ? "border-gold bg-gold/5"
                  : "border-black/15 hover:border-gold/60"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-8 w-8 text-navy/40"
              >
                <path
                  d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {file ? (
                <p className="text-sm font-medium text-navy">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-navy">اسحب الملف هنا أو اضغط للاختيار</p>
                  <p className="text-xs text-foreground/50">PDF، Word، صور — حتى 25 ميجابايت</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">اسم المستند</label>
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="مثال: مذكرة دفاع أولى"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">مستوى الاطّلاع</label>
            <select
              name="visibilityLevel"
              defaultValue="case_team"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
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
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "جارٍ الرفع..." : "رفع المستند"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

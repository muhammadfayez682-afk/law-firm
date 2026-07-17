"use client";

import { useMemo, useState } from "react";
import {
  fieldDefinitions,
  FIELD_CATEGORY_LABELS_AR,
  type FieldDefinitionCategory,
  type FieldDefinitionKey,
} from "@/lib/fieldDefinitions";

type Entry = {
  key: FieldDefinitionKey;
  label: string;
  tooltip: string;
  example?: string;
  category: FieldDefinitionCategory;
};

const ALL_ENTRIES: Entry[] = (Object.keys(fieldDefinitions) as FieldDefinitionKey[]).map((key) => {
  const d = fieldDefinitions[key];
  return {
    key,
    label: d.label,
    tooltip: d.tooltip,
    example: "example" in d ? d.example : undefined,
    category: d.category,
  };
});

const CATEGORY_ORDER = Object.keys(FIELD_CATEGORY_LABELS_AR) as FieldDefinitionCategory[];

export function GlossaryView() {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<FieldDefinitionCategory | "all">("all");

  const filtered = useMemo(() => {
    const term = q.trim();
    return ALL_ENTRIES.filter((e) => {
      if (activeCat !== "all" && e.category !== activeCat) return false;
      if (!term) return true;
      return e.label.includes(term) || e.tooltip.includes(term) || (e.example ?? "").includes(term);
    });
  }, [q, activeCat]);

  const grouped = useMemo(() => {
    const g = {} as Record<FieldDefinitionCategory, Entry[]>;
    for (const e of filtered) (g[e.category] ??= []).push(e);
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">📖 قاموس المصطلحات</h1>
        <p className="text-sm text-foreground/60">
          مرجع لكل المصطلحات القانونية المستخدمة في النظام — للموظفين الجدد والمحامين المتدربين.
        </p>
      </div>

      {/* البحث */}
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن مصطلح أو تعريف..."
          className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        {/* تصنيف بالفئات */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCat("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${activeCat === "all" ? "bg-navy text-white" : "bg-black/5 text-foreground/70 hover:bg-black/10"}`}
          >
            الكل
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCat(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${activeCat === cat ? "bg-navy text-white" : "bg-black/5 text-foreground/70 hover:bg-black/10"}`}
            >
              {FIELD_CATEGORY_LABELS_AR[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* النتائج */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-black/5 bg-white px-4 py-12 text-center text-sm text-foreground/50 shadow-sm">
          لا توجد مصطلحات مطابقة
        </p>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
            <section key={cat}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
                <span className="inline-block h-4 w-1 rounded bg-gold" />
                {FIELD_CATEGORY_LABELS_AR[cat]}
                <span className="text-xs font-normal text-foreground/40">({grouped[cat].length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {grouped[cat].map((e) => (
                  <div key={e.key} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-navy">{e.label}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{e.tooltip}</p>
                    {e.example && (
                      <p className="mt-2 border-t border-black/5 pt-2 text-xs text-foreground/50">
                        مثال: {e.example}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// حقول تشكيل فريق القضية — مشترك بين مودال التفعيل ومودال تعديل الفريق.
import { useMemo } from "react";

export type TeamUser = { id: string; fullName: string; role: string };

export type TeamState = {
  supervisorId: string; // "" = بدون مشرف
  leadLawyerId: string;
  coLawyerIds: string[];
  researcherIds: string[];
};

export const EMPTY_TEAM: TeamState = {
  supervisorId: "",
  leadLawyerId: "",
  coLawyerIds: [],
  researcherIds: [],
};

const SUPERVISOR_ROLES = ["system_admin", "supervisor"];
const LEAD_LAWYER_ROLES = ["system_admin", "supervisor", "lawyer"];

const selectClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-gold";

function Badge({ text, tone }: { text: string; tone: "optional" | "required" }) {
  const cls = tone === "required" ? "bg-red-100 text-red-700" : "bg-black/5 text-foreground/60";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>;
}

export function TeamFormationFields({
  users,
  value,
  onChange,
}: {
  users: TeamUser[];
  value: TeamState;
  onChange: (next: TeamState) => void;
}) {
  const nameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.fullName]));
    return (id: string) => map.get(id) ?? id;
  }, [users]);

  const supervisors = users.filter((u) => SUPERVISOR_ROLES.includes(u.role));
  const leadLawyers = users.filter((u) => LEAD_LAWYER_ROLES.includes(u.role));
  const lawyers = users.filter((u) => u.role === "lawyer");
  const researchers = users.filter((u) => u.role === "researcher");

  // المرشّحون لكل قائمة متعددة: يُستبعد المختارون فعلًا والمحامي الرئيسي.
  const coLawyerCandidates = lawyers.filter(
    (u) => u.id !== value.leadLawyerId && !value.coLawyerIds.includes(u.id)
  );
  const researcherCandidates = researchers.filter((u) => !value.researcherIds.includes(u.id));

  return (
    <div className="space-y-4">
      {/* المشرف الرئيسي — اختياري */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-navy">
          🏛️ المشرف الرئيسي <Badge text="اختياري" tone="optional" />
        </label>
        <select
          className={selectClass}
          value={value.supervisorId}
          onChange={(e) => onChange({ ...value, supervisorId: e.target.value })}
        >
          <option value="">— بدون مشرف —</option>
          {supervisors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* المحامي الرئيسي — إلزامي، واحد */}
      <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-navy">
          ⚖️ المحامي الرئيسي <Badge text="إلزامي · واحد فقط" tone="required" />
        </label>
        <select
          className={selectClass}
          value={value.leadLawyerId}
          onChange={(e) => {
            const leadLawyerId = e.target.value;
            // إن أصبح المحامي الرئيسي أحد المساعدين، أزِله من المساعدين.
            onChange({
              ...value,
              leadLawyerId,
              coLawyerIds: value.coLawyerIds.filter((id) => id !== leadLawyerId),
            });
          }}
        >
          <option value="" disabled>
            اختر المحامي الرئيسي
          </option>
          {leadLawyers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* المحامون المساعدون — عدد مفتوح */}
      <TagMultiSelect
        icon="⚖️"
        label="المحامون المساعدون"
        badge="اختياري · عدد مفتوح"
        addLabel="+ إضافة محامٍ مساعد"
        selectedIds={value.coLawyerIds}
        candidates={coLawyerCandidates}
        nameOf={nameOf}
        onAdd={(id) => onChange({ ...value, coLawyerIds: [...value.coLawyerIds, id] })}
        onRemove={(id) =>
          onChange({ ...value, coLawyerIds: value.coLawyerIds.filter((x) => x !== id) })
        }
      />

      {/* الباحثون القانونيون — عدد مفتوح */}
      <TagMultiSelect
        icon="📚"
        label="الباحثون القانونيون"
        badge="اختياري · عدد مفتوح"
        addLabel="+ إضافة باحث"
        selectedIds={value.researcherIds}
        candidates={researcherCandidates}
        nameOf={nameOf}
        onAdd={(id) => onChange({ ...value, researcherIds: [...value.researcherIds, id] })}
        onRemove={(id) =>
          onChange({ ...value, researcherIds: value.researcherIds.filter((x) => x !== id) })
        }
      />

      {/* بيان تحذيري */}
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        ⚠️ الفريق مسؤول عن القضية بالكامل. كل عضو يستطيع الوصول للمستندات والمذكرات وتعديل ما يخصّ دوره.
      </p>
    </div>
  );
}

function TagMultiSelect({
  icon,
  label,
  badge,
  addLabel,
  selectedIds,
  candidates,
  nameOf,
  onAdd,
  onRemove,
}: {
  icon: string;
  label: string;
  badge: string;
  addLabel: string;
  selectedIds: string[];
  candidates: TeamUser[];
  nameOf: (id: string) => string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-navy">
        {icon} {label} <Badge text={badge} tone="optional" />
        {selectedIds.length > 0 && (
          <span className="text-xs text-foreground/50">({selectedIds.length})</span>
        )}
      </label>

      {selectedIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-1 text-xs text-navy"
            >
              {nameOf(id)}
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-navy/50 hover:text-red-600"
                aria-label={`إزالة ${nameOf(id)}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <select
        className={selectClass}
        value=""
        disabled={candidates.length === 0}
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
      >
        <option value="">{candidates.length ? addLabel : "لا مزيد من الأعضاء المتاحين"}</option>
        {candidates.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}

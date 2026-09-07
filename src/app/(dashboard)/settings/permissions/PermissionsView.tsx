"use client";

import {
  PERMISSION_DOMAINS,
  ROLE_ORDER,
  ROLE_LABELS_AR,
  LEVEL_META,
  DELEGATION_CHAIN,
  DELEGATABLE_PERMISSIONS,
  roleCell,
  type PermissionDef,
  type RoleKey,
} from "@/lib/permissions-registry";

function LevelIcon({ level, note }: { level: keyof typeof LEVEL_META; note?: string }) {
  const meta = LEVEL_META[level];
  const title = note ? `${meta.label} — ${note}` : `${meta.label}: ${meta.desc}`;
  const tone =
    level === "role_global"
      ? "text-emerald-700"
      : level === "case_scoped"
        ? "text-taradhi"
        : level === "delegatable"
          ? "text-gold"
          : "text-foreground/25";
  return (
    <span className="inline-flex items-center justify-center gap-0.5" title={title}>
      <span className={`text-base ${tone}`}>{meta.icon}</span>
      {note && <span className="text-[9px] leading-none text-amber-600" aria-hidden>•</span>}
    </span>
  );
}

function PermissionRow({ perm }: { perm: PermissionDef }) {
  return (
    <tr className="border-t border-black/5 hover:bg-black/[0.015]">
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-start gap-1.5">
          <span className="text-sm text-navy">{perm.label}</span>
          {perm.delegatable && (
            <span
              className="mt-0.5 shrink-0 rounded bg-gold/10 px-1 text-[10px] font-medium text-gold"
              title="قابلة للتفويض على مستوى القضية للأدنى في السلسلة — انظر قسم «سلسلة التفويض»."
            >
              🔑 تفويض
            </span>
          )}
          {perm.protectedRule && (
            <span className="mt-0.5 shrink-0 cursor-help text-xs" title={`قاعدة ثابتة: ${perm.protectedRule}`}>
              🔒
            </span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-foreground/35" dir="ltr">{perm.source}</div>
      </td>
      {ROLE_ORDER.map((role) => {
        const { level, note } = roleCell(perm.roles[role]);
        return (
          <td key={role} className="px-2 py-2.5 text-center align-middle">
            <LevelIcon level={level} note={note} />
          </td>
        );
      })}
    </tr>
  );
}

export function PermissionsView() {
  return (
    <div className="space-y-6">
      {/* المفتاح الدلالي */}
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-navy">المفتاح الدلالي</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["role_global", "case_scoped", "delegatable", "none"] as const).map((lvl) => (
            <div key={lvl} className="flex items-start gap-2 rounded-lg bg-black/[0.02] px-3 py-2">
              <span className="text-base">{LEVEL_META[lvl].icon}</span>
              <div>
                <p className="text-xs font-medium text-navy">{LEVEL_META[lvl].label}</p>
                <p className="text-[11px] leading-relaxed text-foreground/55">{LEVEL_META[lvl].desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-3 text-[11px] text-foreground/55">
          <span>🔒 مرتبطة بقاعدة منطقية ثابتة (مرّر المؤشر لعرضها).</span>
          <span>🔑 قابلة للتفويض على مستوى القضية.</span>
          <span className="text-amber-600">• ملاحظة على الخلية (مرّر المؤشر).</span>
        </div>
      </div>

      {/* أقسام المجالات */}
      {PERMISSION_DOMAINS.map((domain, idx) => (
        <details key={domain.key} open={idx < 2} className="group rounded-xl border border-black/5 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 select-none">
            <span className="flex items-center gap-2 font-semibold text-navy">
              <span>{domain.icon}</span>
              {domain.title}
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-normal text-foreground/50">
                {domain.permissions.length}
              </span>
            </span>
            <span className="text-foreground/40 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="overflow-x-auto border-t border-black/5">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-black/[0.02] text-[11px] text-foreground/55">
                  <th className="px-3 py-2 text-right font-medium">الصلاحية</th>
                  {ROLE_ORDER.map((role) => (
                    <th key={role} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                      {ROLE_LABELS_AR[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {domain.permissions.map((perm) => (
                  <PermissionRow key={perm.key} perm={perm} />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}

      {/* سلسلة التفويض */}
      <div className="rounded-xl border border-gold/20 bg-gold/[0.03] p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-navy">🔑 سلسلة التفويض</h2>
        <p className="mb-4 text-xs leading-relaxed text-foreground/60">
          يُفوَّض الأدنى رتبةً فقط (لا أفقي ولا صاعد)، ولا يُفوَّض إلا ما يملكه المُفوِّض بوضعه المباشر
          (لا تصعيد امتيازات)، ويسقط التفويض إن فقد المُفوِّض صلاحيته. <strong>DENY الصريح يتفوّق دائمًا.</strong>
        </p>

        <div className="mb-5 flex flex-wrap items-stretch gap-2">
          {DELEGATION_CHAIN.map((node, i) => (
            <div key={node.role} className="flex items-center gap-2">
              <div className="rounded-lg border border-navy/10 bg-white px-3 py-2 text-center">
                <p className="text-sm font-medium text-navy">{ROLE_LABELS_AR[node.role]}</p>
                <p className="text-[10px] text-foreground/45">رتبة {node.rank}</p>
              </div>
              {i < DELEGATION_CHAIN.length - 1 &&
                DELEGATION_CHAIN[i + 1].rank < node.rank && (
                  <span className="text-gold" aria-hidden>←</span>
                )}
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs font-semibold text-navy">الصلاحيات القابلة للتفويض وأساس مالكيها:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-white/60 text-[11px] text-foreground/55">
                <th className="px-3 py-2 text-right font-medium">الصلاحية</th>
                <th className="px-3 py-2 text-right font-medium">من يملكها بالأساس</th>
              </tr>
            </thead>
            <tbody>
              {DELEGATABLE_PERMISSIONS.map((d) => (
                <tr key={d.key} className="border-t border-black/5">
                  <td className="px-3 py-2 text-navy">
                    <span className="font-medium">{d.label}</span>
                    <span className="mr-1 font-mono text-[10px] text-foreground/35" dir="ltr">{d.key}</span>
                  </td>
                  <td className="px-3 py-2 text-foreground/70">{d.base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

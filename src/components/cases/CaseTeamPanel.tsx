"use client";

// عرض فريق القضية مجمّعًا حسب الدور + مودال تعديل الفريق (لمسؤول النظام والمشرف).
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseTeamRole } from "@prisma/client";
import { TEAM_ROLE_LABELS_AR } from "@/lib/caseTeam";
import {
  TeamFormationFields,
  type TeamState,
  type TeamUser,
} from "@/components/cases/TeamFormationFields";

export type TeamMemberView = {
  id: string;
  userId: string;
  fullName: string;
  roleInCase: CaseTeamRole;
};

export function CaseTeamPanel({
  caseId,
  caseTitle,
  team,
  teamUsers,
  canEdit,
}: {
  caseId: string;
  caseTitle: string;
  team: TeamMemberView[];
  teamUsers: TeamUser[];
  canEdit: boolean;
}) {
  const [showEdit, setShowEdit] = useState(false);

  const leadSupervisor = team.find((m) => m.roleInCase === "lead_supervisor");
  const leadLawyer = team.find((m) => m.roleInCase === "lead_lawyer");
  const coLawyers = team.filter((m) => m.roleInCase === "co_lawyer");
  const researchers = team.filter((m) => m.roleInCase === "researcher");

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">👥 فريق القضية</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="rounded-lg border border-navy/20 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/5"
          >
            تعديل الفريق ✎
          </button>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <RoleBlock icon="🏛️" title="المشرف الرئيسي">
          {leadSupervisor ? (
            <p className="text-navy">{leadSupervisor.fullName}</p>
          ) : (
            <p className="text-foreground/40">—</p>
          )}
        </RoleBlock>

        <RoleBlock icon="⚖️" title="المحامي الرئيسي">
          {leadLawyer ? (
            <p className="font-medium text-navy">{leadLawyer.fullName}</p>
          ) : (
            <p className="text-red-600">غير محدّد</p>
          )}
        </RoleBlock>

        {coLawyers.length > 0 && (
          <RoleBlock icon="⚖️" title={`محامون مساعدون (${coLawyers.length})`}>
            <ul className="space-y-0.5">
              {coLawyers.map((m) => (
                <li key={m.id} className="text-navy">• {m.fullName}</li>
              ))}
            </ul>
          </RoleBlock>
        )}

        {researchers.length > 0 && (
          <RoleBlock icon="📚" title={`الباحثون القانونيون (${researchers.length})`}>
            <ul className="space-y-0.5">
              {researchers.map((m) => (
                <li key={m.id} className="text-navy">• {m.fullName}</li>
              ))}
            </ul>
          </RoleBlock>
        )}

        {team.length === 0 && <p className="text-foreground/50">لا يوجد أعضاء مسندون</p>}
      </div>

      {showEdit && (
        <EditTeamModal
          caseId={caseId}
          caseTitle={caseTitle}
          team={team}
          teamUsers={teamUsers}
          onClose={() => setShowEdit(false)}
        />
      )}
    </section>
  );
}

function RoleBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-foreground/50">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

function teamToState(team: TeamMemberView[]): TeamState {
  return {
    supervisorId: team.find((m) => m.roleInCase === "lead_supervisor")?.userId ?? "",
    leadLawyerId: team.find((m) => m.roleInCase === "lead_lawyer")?.userId ?? "",
    coLawyerIds: team.filter((m) => m.roleInCase === "co_lawyer").map((m) => m.userId),
    researcherIds: team.filter((m) => m.roleInCase === "researcher").map((m) => m.userId),
  };
}

function EditTeamModal({
  caseId,
  caseTitle,
  team,
  teamUsers,
  onClose,
}: {
  caseId: string;
  caseTitle: string;
  team: TeamMemberView[];
  teamUsers: TeamUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<TeamState>(() => teamToState(team));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!state.leadLawyerId) {
      toast.error("المحامي الرئيسي إلزامي — لا يمكن إزالته دون تعيين بديل");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/team`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: {
            supervisorId: state.supervisorId || null,
            leadLawyerId: state.leadLawyerId,
            coLawyerIds: state.coLawyerIds,
            researcherIds: state.researcherIds,
          },
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر حفظ الفريق");
        return;
      }
      toast.success("حُدّث فريق القضية");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-lg font-bold text-navy">تعديل فريق القضية: {caseTitle}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        <TeamFormationFields users={teamUsers} value={state} onChange={setState} />
        <div className="mt-5 flex justify-end gap-3 border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={busy || !state.leadLawyerId}
            onClick={save}
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {busy ? "جارٍ الحفظ..." : "حفظ الفريق"}
          </button>
        </div>
      </div>
    </div>
  );
}

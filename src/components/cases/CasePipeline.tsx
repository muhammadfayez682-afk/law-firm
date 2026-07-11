import type { CaseFlowStage, CaseStatus } from "@prisma/client";

const DIRECT_TO_COURT_STEPS = ["استلام", "المحكمة مباشرة", "حكم"];

function getDirectToCourtStep(status: CaseStatus): number {
  switch (status) {
    case "intake":
      return 0;
    case "closed":
    case "archived":
      return 2;
    default:
      return 1;
  }
}

/** رقم المرحلة النشطة ضمن مسار مُعرَّف (1..totalStages) بحسب حالة القضية الحالية. */
function getActiveStageOrder(status: CaseStatus, totalStages: number): number {
  switch (status) {
    case "amicable_settlement":
    case "settled_amicably":
      return 1;
    case "open":
    case "in_progress":
    case "on_hold":
    case "ruled_first_instance":
      return Math.min(2, totalStages);
    case "appealed":
      return Math.min(3, totalStages);
    case "closed":
    case "archived":
      return totalStages;
    case "intake":
    default:
      return totalStages > 0 ? 1 : 0;
  }
}

function StepList({
  steps,
  isDone,
  isActive,
}: {
  steps: string[];
  isDone: (index: number) => boolean;
  isActive: (index: number) => boolean;
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const done = isDone(index);
        const active = isActive(index);
        const isLast = index === steps.length - 1;

        return (
          <li key={`${step}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-gold text-navy"
                    : active
                      ? "bg-taradhi text-white ring-4 ring-taradhi/20"
                      : "bg-black/5 text-foreground/40"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              {!isLast && (
                <span
                  className={`w-px flex-1 ${done ? "bg-gold" : "bg-black/10"}`}
                  style={{ minHeight: "1.75rem" }}
                />
              )}
            </div>
            <div className={isLast ? "pb-0" : "pb-7"}>
              <p
                className={`text-sm font-medium ${
                  active ? "text-taradhi" : done ? "text-navy" : "text-foreground/40"
                }`}
              >
                {step}
                {active && <span className="mr-1.5 text-xs font-normal">(نشط)</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CasePipeline({
  stages,
  status,
}: {
  stages: CaseFlowStage[];
  status: CaseStatus;
}) {
  const hasStages = stages.length > 0;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-navy">مسار القضية</h2>
      {hasStages ? (
        <StepList
          steps={stages.map((s) => (s.isMandatory ? s.labelAr : `${s.labelAr} (اختياري)`))}
          isDone={(i) => stages[i].order < getActiveStageOrder(status, stages.length)}
          isActive={(i) => stages[i].order === getActiveStageOrder(status, stages.length)}
        />
      ) : (
        <StepList
          steps={DIRECT_TO_COURT_STEPS}
          isDone={(i) => i < getDirectToCourtStep(status)}
          isActive={(i) => i === getDirectToCourtStep(status)}
        />
      )}
    </div>
  );
}

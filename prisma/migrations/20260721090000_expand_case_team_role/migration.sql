-- توسيع CaseTeamRole إلى تشكيل فريق كامل:
-- lead_supervisor / co_supervisor / lead_lawyer / co_lawyer / researcher.
-- تعيين القيم القديمة: supervisor→lead_supervisor، lawyer→lead_lawyer، researcher→researcher.

ALTER TYPE "CaseTeamRole" RENAME TO "CaseTeamRole_old";

CREATE TYPE "CaseTeamRole" AS ENUM ('lead_supervisor', 'co_supervisor', 'lead_lawyer', 'co_lawyer', 'researcher');

ALTER TABLE "case_team_members"
  ALTER COLUMN "roleInCase" TYPE "CaseTeamRole"
  USING (
    CASE "roleInCase"::text
      WHEN 'supervisor' THEN 'lead_supervisor'
      WHEN 'lawyer' THEN 'lead_lawyer'
      WHEN 'researcher' THEN 'researcher'
      ELSE 'co_lawyer'
    END::"CaseTeamRole"
  );

DROP TYPE "CaseTeamRole_old";

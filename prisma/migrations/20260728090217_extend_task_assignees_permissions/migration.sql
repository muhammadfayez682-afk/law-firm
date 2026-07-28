-- CreateEnum
CREATE TYPE "TaskAssigneePermission" AS ENUM ('view', 'edit', 'complete');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'task_assigned_multi';
ALTER TYPE "NotificationType" ADD VALUE 'task_assignee_completed';
ALTER TYPE "NotificationType" ADD VALUE 'task_recreated';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'rejected';

-- AlterTable
ALTER TABLE "task_assignees" ADD COLUMN     "permission" "TaskAssigneePermission" NOT NULL DEFAULT 'complete';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "parentTaskId" TEXT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: أنشئ TaskAssignee لكل مهمة قديمة من assignedToId (توافق البيانات الموجودة).
INSERT INTO "task_assignees" ("id", "taskId", "userId", "permission", "status", "completedAt", "completionNote", "createdAt")
SELECT gen_random_uuid(), t."id", t."assignedToId", 'complete'::"TaskAssigneePermission",
  (CASE t."status"::text
    WHEN 'completed' THEN 'completed'
    WHEN 'in_progress' THEN 'in_progress'
    ELSE 'pending'
  END)::"TaskAssigneeStatus",
  t."completedAt", t."completionNote", now()
FROM "tasks" t
WHERE NOT EXISTS (
  SELECT 1 FROM "task_assignees" ta WHERE ta."taskId" = t."id" AND ta."userId" = t."assignedToId"
);

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('intake_new', 'intake_conflict_detected', 'intake_pending_assessment', 'intake_assessment_delegated', 'intake_pending_decision', 'intake_accepted', 'intake_rejected', 'memo_assigned', 'memo_pending_review', 'memo_changes_requested', 'memo_approved', 'memo_submitted_to_court', 'case_assigned', 'case_closure_requested', 'case_closure_approved', 'case_closure_rejected', 'case_reopened', 'case_number_added', 'session_scheduled', 'session_reminder_day', 'session_reminder_hour', 'session_cancelled', 'session_postponed', 'agency_expiring_soon', 'agency_expiring_urgent', 'agency_expired', 'settlement_deadline_soon', 'settlement_deadline_urgent', 'settlement_settled', 'settlement_failed', 'task_assigned', 'task_due_soon', 'task_overdue', 'task_completed', 'task_comment_added', 'invoice_overdue', 'mention', 'system_announcement');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'sms', 'whatsapp');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "channels" "NotificationChannel"[] DEFAULT ARRAY['in_app']::"NotificationChannel"[],
    "deliveryLog" JSONB,
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channels" "NotificationChannel"[],

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientId_isRead_createdAt_idx" ON "notifications"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_resourceType_resourceId_idx" ON "notifications"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_type_key" ON "notification_preferences"("userId", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

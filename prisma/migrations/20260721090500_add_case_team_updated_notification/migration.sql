-- نوع إشعار جديد: تغيّر تشكيل فريق القضية (إضافة/إزالة عضو).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'case_team_updated';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/CalendarView";

/** التقويم العدلي التفاعلي — صفحة قائمة بذاتها (شهري/أسبوعي/قائمة). الأحداث مقيّدة بصلاحية المستخدم عبر الـ API. */
export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">التقويم العدلي</h1>
        <p className="text-sm text-foreground/60">
          جلساتك ومهل التسوية واستحقاقات مهامك على قضاياك — بالتقويمين الهجري والميلادي
        </p>
      </div>

      <CalendarView />
    </div>
  );
}

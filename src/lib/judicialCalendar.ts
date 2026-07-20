// التقويم العدلي: العطل الرسمية القضائية السعودية وأيام العمل.
// ملف نقيّ (بلا خادم) يُستورد في الواجهة والخادم.
// ⚠️ التواريخ الميلادية للأعياد تقريبية (تُثبَّت رسميًا برؤية الهلال) —
//   حدّثها من تقويم وزارة العدل السنوي عند صدوره.

export type JudicialHoliday = {
  gregorian: string; // YYYY-MM-DD (بداية العطلة)
  hijri?: string;
  name: string;
  duration: number; // عدد الأيام
};

export const judicialHolidays2026: JudicialHoliday[] = [
  { gregorian: "2026-02-22", name: "يوم التأسيس", duration: 1 },
  { hijri: "1447-10-01", gregorian: "2026-03-19", name: "عيد الفطر", duration: 4 },
  { hijri: "1447-12-08", gregorian: "2026-05-26", name: "يوم عرفة", duration: 1 },
  { hijri: "1447-12-10", gregorian: "2026-05-28", name: "عيد الأضحى", duration: 4 },
  { hijri: "1448-01-01", gregorian: "2026-06-17", name: "رأس السنة الهجرية", duration: 1 },
  { gregorian: "2026-09-23", name: "اليوم الوطني", duration: 1 },
];

// المواسم القضائية (إجازة صيفية اختيارية — لا تُعدّ عطلة رسمية تمنع الجلسات).
export const judicialSeasons = {
  summerBreak: { start: "2026-06-15", end: "2026-08-15", name: "العطلة الصيفية القضائية" },
};

function dateKey(d: Date): string {
  // مفتاح محلي YYYY-MM-DD (يتجنّب انزياح UTC).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export type HolidayCheck = { isHoliday: boolean; name?: string; duration?: number };

/** هل التاريخ يقع ضمن عطلة رسمية قضائية؟ */
export function isJudicialHoliday(date: Date): HolidayCheck {
  const key = dateKey(date);
  for (const h of judicialHolidays2026) {
    for (let i = 0; i < h.duration; i++) {
      if (addDays(h.gregorian, i) === key) {
        return { isHoliday: true, name: h.name, duration: h.duration };
      }
    }
  }
  return { isHoliday: false };
}

/** الجمعة (5) والسبت (6) عطلة نهاية الأسبوع. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6;
}

/** يوم عمل قضائي = ليس نهاية أسبوع ولا عطلة رسمية. */
export function isCourtWorkingDay(date: Date): boolean {
  if (isWeekend(date)) return false;
  return !isJudicialHoliday(date).isHoliday;
}

/** حساب "بعد X أيام عمل" (مهم لمواعيد المحكمة ومهل التسوية). */
export function addBusinessDays(startDate: Date, days: number): Date {
  let count = 0;
  const current = new Date(startDate);
  while (count < days) {
    current.setDate(current.getDate() + 1);
    if (isCourtWorkingDay(current)) count++;
  }
  return current;
}

/** أقرب عطلة رسمية قادمة من تاريخ معيّن (للتنبيه في الواجهة). */
export function nextHoliday(from: Date = new Date()): (JudicialHoliday & { daysUntil: number }) | null {
  const fromKey = dateKey(from);
  const upcoming = judicialHolidays2026
    .filter((h) => h.gregorian >= fromKey)
    .sort((a, b) => a.gregorian.localeCompare(b.gregorian))[0];
  if (!upcoming) return null;
  const daysUntil = Math.ceil((new Date(upcoming.gregorian + "T00:00:00").getTime() - from.getTime()) / (24 * 3600 * 1000));
  return { ...upcoming, daysUntil };
}

/** حالة يوم واحد (للعرض): عطلة رسمية / نهاية أسبوع / يوم عمل. */
export function dayStatus(date: Date): { kind: "holiday" | "weekend" | "working"; label: string; name?: string } {
  const h = isJudicialHoliday(date);
  if (h.isHoliday) return { kind: "holiday", label: h.name ?? "عطلة رسمية", name: h.name };
  if (isWeekend(date)) return { kind: "weekend", label: "عطلة نهاية الأسبوع" };
  return { kind: "working", label: "يوم عمل" };
}

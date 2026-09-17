import moment from "moment-hijri";

// نضمن أرقامًا إنجليزية دائمًا بغض النظر عن لغة النظام.
moment.locale("en");

/** تحويل ميلادي لهجري بأرقام إنجليزية، مثال: 1447/01/15 */
export function toHijri(date: Date | string): string {
  return moment(date).format("iYYYY/iMM/iDD");
}

/** التاريخ الميلادي بأرقام إنجليزية، مثال: 2026/07/11 */
export function toGregorian(date: Date | string): string {
  return moment(date).format("YYYY/MM/DD");
}

/** عرض التاريخين معًا: هجري (ميلادي) */
export function formatDualDate(date: Date | string): string {
  const hijri = moment(date).format("iYYYY/iMM/iDD");
  const greg = moment(date).format("YYYY/MM/DD");
  return `${hijri}هـ (${greg}م)`;
}

/** عرض التاريخين والوقت معًا */
export function formatDualDateTime(date: Date | string): string {
  const hijri = moment(date).format("iYYYY/iMM/iDD");
  const greg = moment(date).format("YYYY/MM/DD");
  const time = moment(date).format("HH:mm");
  return `${hijri}هـ (${greg}م) — ${time}`;
}

const DAY_NAMES_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** اسم اليوم بالعربي */
export function getDayNameAr(date: Date | string): string {
  return DAY_NAMES_AR[new Date(date).getDay()];
}

/** الوقت فقط، بأرقام إنجليزية (HH:mm) */
export function formatTime(date: Date | string): string {
  return moment(date).format("HH:mm");
}

const HIJRI_MONTH_NAMES_AR = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

/** اسم الشهر الهجري بالعربي، مع سنته */
export function getHijriMonthLabel(date: Date | string): string {
  const m = moment(date);
  const monthIndex = m.iMonth();
  return `${HIJRI_MONTH_NAMES_AR[monthIndex]} ${m.format("iYYYY")}هـ`;
}

const GREGORIAN_MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** أسماء أيام الأسبوع مختصرة، تبدأ بالأحد (نمط التقويم السعودي). */
export const WEEKDAY_SHORT_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** اسم الشهر الميلادي بالعربي، مع سنته: «سبتمبر 2026م» (أرقام إنجليزية). */
export function getGregorianMonthLabelAr(date: Date | string): string {
  const m = moment(date);
  return `${GREGORIAN_MONTH_NAMES_AR[m.month()]} ${m.format("YYYY")}م`;
}

/** تاريخ اليوم بالهجري: «17 رمضان 1447هـ» (أرقام إنجليزية). */
export function getHijriDayLabel(date: Date | string): string {
  const m = moment(date);
  return `${m.format("iD")} ${HIJRI_MONTH_NAMES_AR[m.iMonth()]} ${m.format("iYYYY")}هـ`;
}

/** التاريخ الكامل بالصيغتين: «الأحد 17 رمضان 1447هـ (6 سبتمبر 2026م)». */
export function getFullDualLabel(date: Date | string): string {
  const m = moment(date);
  const greg = `${m.format("D")} ${GREGORIAN_MONTH_NAMES_AR[m.month()]} ${m.format("YYYY")}م`;
  return `${getDayNameAr(date)} ${getHijriDayLabel(date)} (${greg})`;
}

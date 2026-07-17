import { toEnglishDigits } from "@/lib/formatNumber";

/** وقت نسبي بالعربية بأرقام إنجليزية: «الآن»، «قبل 5 دقائق»، «قبل 3 ساعات»، «قبل يومين»... */
export function relativeTimeAr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);

  if (sec < 45) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "قبل دقيقة" : min === 2 ? "قبل دقيقتين" : `قبل ${toEnglishDigits(String(min))} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "قبل ساعة" : hr === 2 ? "قبل ساعتين" : `قبل ${toEnglishDigits(String(hr))} ساعات`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? "قبل يوم" : day === 2 ? "قبل يومين" : `قبل ${toEnglishDigits(String(day))} يومًا`;
  const month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? "قبل شهر" : month === 2 ? "قبل شهرين" : `قبل ${toEnglishDigits(String(month))} أشهر`;
  const year = Math.floor(day / 365);
  return year === 1 ? "قبل سنة" : year === 2 ? "قبل سنتين" : `قبل ${toEnglishDigits(String(year))} سنوات`;
}

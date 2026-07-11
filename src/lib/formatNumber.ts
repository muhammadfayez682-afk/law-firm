const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** يضمن أن الأرقام إنجليزية دائمًا حتى لو وردت بصيغة عربية-هندية. */
export function toEnglishDigits(input: string | number): string {
  return String(input).replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

/** تنسيق المبالغ المالية بأرقام إنجليزية مع "ر.س". */
export function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("en-US").format(amount)} ر.س`;
}

/** تنسيق أي رقم بفواصل الآلاف بأرقام إنجليزية. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

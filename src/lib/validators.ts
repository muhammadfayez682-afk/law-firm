// أدوات تحقق مشتركة (أرقام سعودية + قوة كلمة المرور).

/**
 * توحيد صيغة الجوال السعودي إلى 05XXXXXXXX:
 * يحوّل +9665X / 9665X إلى 05X، ويحذف المسافات والشرطات.
 * يُستخدم قبل الحفظ والمقارنة لضمان صيغة واحدة تمنع التكرار المموّه.
 */
export function normalizeSaudiPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+966")) return "0" + cleaned.slice(4);
  if (cleaned.startsWith("966")) return "0" + cleaned.slice(3);
  return cleaned;
}

/** رقم الجوال السعودي: 10 خانات بالضبط تبدأ بـ 05 (بعد التوحيد). */
export function isValidSaudiPhone(phone: string): boolean {
  return /^05\d{8}$/.test(normalizeSaudiPhone(phone));
}

/** رسالة خطأ تفصيلية للجوال (للعرض الفوري تحت الحقل)، أو null إن كان صحيحًا. */
export function saudiPhoneError(phone: string): string | null {
  const cleaned = normalizeSaudiPhone(phone);
  if (!cleaned) return "رقم الجوال مطلوب";
  if (!/^\d+$/.test(cleaned)) return "رقم الجوال يجب أن يحتوي أرقامًا فقط";
  if (!cleaned.startsWith("05")) return "رقم الجوال يجب أن يبدأ بـ 05";
  if (cleaned.length !== 10) return "رقم الجوال يجب أن يكون 10 أرقام";
  return null;
}

/** الهوية الوطنية (تبدأ بـ 1) أو الإقامة (تبدأ بـ 2) — 10 أرقام + خوارزمية Luhn المعدّلة. */
export function isValidSaudiId(id: string): boolean {
  if (!/^[12]\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(id[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(id[9], 10);
}

/** السجل التجاري: 10 أرقام. */
export function isValidCommercialRegister(cr: string): boolean {
  return /^\d{10}$/.test(cr);
}

/** رقم الوكالة: أرقام فقط، 6-15 خانة. */
export function isValidAgencyNumber(agency: string): boolean {
  return /^\d{6,15}$/.test(agency);
}

/** رقم القضية الداخلي بصيغة MZN-YYYY-NNNN. */
export function isValidInternalCaseNumber(num: string): boolean {
  return /^MZN-\d{4}-\d{4}$/.test(num);
}

/**
 * رقم الهوية أو السجل التجاري حسب نوع العميل.
 * فرد → هوية/إقامة، شركة → سجل تجاري.
 */
export function isValidNationalIdOrCr(value: string, type: "individual" | "company"): boolean {
  return type === "individual" ? isValidSaudiId(value) : isValidCommercialRegister(value);
}

/** قوة كلمة المرور: 8 أحرف على الأقل + حرف كبير + صغير + رقم. */
export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (!/[A-Z]/.test(password)) return "كلمة المرور يجب أن تحتوي حرفًا كبيرًا (A-Z)";
  if (!/[a-z]/.test(password)) return "كلمة المرور يجب أن تحتوي حرفًا صغيرًا (a-z)";
  if (!/\d/.test(password)) return "كلمة المرور يجب أن تحتوي رقمًا (0-9)";
  return null;
}

export function isStrongPassword(password: string): boolean {
  return passwordStrengthError(password) === null;
}

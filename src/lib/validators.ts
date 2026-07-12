// أدوات تحقق مشتركة (أرقام سعودية + قوة كلمة المرور).

/** رقم الجوال السعودي: 05XXXXXXXX أو +9665XXXXXXXX أو 9665XXXXXXXX. */
export function isValidSaudiPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(?:\+?966|0)5\d{8}$/.test(cleaned);
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

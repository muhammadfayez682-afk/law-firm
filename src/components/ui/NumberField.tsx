"use client";

import { useState } from "react";
import { saudiPhoneError, VALIDATION_MESSAGES } from "@/lib/validators";

type Variant = "phone" | "saudi_id" | "cr" | "agency";

const MAX_LEN: Record<Variant, number> = { phone: 10, saudi_id: 10, cr: 10, agency: 15 };

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

/** رسالة خطأ فورية حسب النوع (أو null إن كان فارغًا/صحيحًا). */
function liveError(variant: Variant, value: string): string | null {
  if (!value) return null;
  if (variant === "phone") return saudiPhoneError(value);
  if (variant === "saudi_id") return value.length !== 10 ? VALIDATION_MESSAGES.nationalId : null;
  if (variant === "cr") return value.length !== 10 ? VALIDATION_MESSAGES.commercialRegister : null;
  if (variant === "agency") return value.length < 6 ? VALIDATION_MESSAGES.agency : null;
  return null;
}

/**
 * حقل رقمي موحّد: يمنع الأحرف غير الرقمية، يفرض الحد الأقصى للطول،
 * ويُظهر رسالة خطأ فورية تحت الحقل. متوافق مع FormData عبر `name`.
 */
export function NumberField({
  name,
  label,
  variant,
  required = false,
  defaultValue = "",
  placeholder,
  onValueChange,
}: {
  name: string;
  label: string;
  variant: Variant;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const maxLen = MAX_LEN[variant];
  const error = touched ? liveError(variant, value) : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, maxLen);
    setValue(cleaned);
    onValueChange?.(cleaned);
  }

  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={maxLen}
        dir="ltr"
        placeholder={placeholder}
        className={`${inputClass} ${error ? "border-red-400" : "border-black/10"}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Props {
  label: string;
  required?: boolean;
  tooltip: string;
  example?: string;
  htmlFor?: string;
}

/**
 * تسمية حقل مع أيقونة (ⓘ) تُظهر توضيحًا للحقل القانوني.
 * تعمل بالتحويم (desktop) وبالنقر (mobile) — لا تعتمد على مكتبة خارجية.
 */
export function FieldTooltip({ label, required, tooltip, example, htmlFor }: Props) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  const visible = open || hover;

  // إغلاق عند النقر خارج العنصر أو الضغط على Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center gap-2 text-sm font-medium text-navy">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      <span ref={containerRef} className="relative inline-flex">
        <button
          type="button"
          aria-label={`توضيح: ${label}`}
          aria-expanded={visible}
          aria-describedby={visible ? tipId : undefined}
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          className="cursor-help text-gray-400 transition-colors hover:text-taradhi"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <circle cx="12" cy="12" r="9" strokeWidth="1.7" />
            <path d="M12 11v5" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </button>

        {visible && (
          <span
            id={tipId}
            role="tooltip"
            className="absolute bottom-full right-1/2 z-50 mb-2 w-64 max-w-[80vw] translate-x-1/2 rounded-lg bg-navy p-3 text-right font-normal text-white shadow-xl"
          >
            <span className="block text-sm leading-relaxed">{tooltip}</span>
            {example && (
              <span className="mt-2 block border-t border-white/20 pt-2 text-xs opacity-80">
                مثال: {example}
              </span>
            )}
          </span>
        )}
      </span>
    </label>
  );
}

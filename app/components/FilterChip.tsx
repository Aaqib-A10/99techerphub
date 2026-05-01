'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterChipOption {
  value: string;
  label: string;
}

interface Props {
  /** Empty string == "all" / cleared */
  value: string;
  onChange: (value: string) => void;
  options: FilterChipOption[];
  /** Label shown when no value is selected, e.g. "All Departments" */
  placeholder: string;
  /** Optional leading icon (16px) */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * FilterChip — compact dropdown chip used in horizontal table toolbars.
 * Behaves like a <select> but renders as a tasteful pill with a popover menu.
 */
export default function FilterChip({
  value,
  onChange,
  options,
  placeholder,
  icon,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label || placeholder;
  const isActive = !!value;

  return (
    <div className={`relative inline-block ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-md border bg-core-surface pl-2.5 pr-1.5 text-[12.5px] font-medium transition-all duration-150 ${
          isActive
            ? 'border-core-border text-core-text shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]'
            : 'border-core-border/95 text-core-text2 hover:border-core-border hover:bg-core-surface2'
        }`}
      >
        {icon && <span className="flex-shrink-0 text-core-text3">{icon}</span>}
        <span className="truncate">{display}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 text-core-text3 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] overflow-hidden rounded-md border border-core-border/85 bg-core-surface shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="max-h-72 overflow-y-auto py-1">
            {/* All / clear option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                !value ? 'bg-core-surface2 font-medium text-core-text' : 'text-core-text2 hover:bg-core-surface2'
              }`}
            >
              <span>{placeholder}</span>
              {!value && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {options.length > 0 && <div className="my-1 h-px bg-core-surface2" />}

            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                    isSelected
                      ? 'bg-core-surface2 font-medium text-core-text'
                      : 'text-core-text2 hover:bg-core-surface2'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface SplitButtonAction {
  label: string;
  href?: string;
  onClick?: () => void;
  description?: string;
  icon?: React.ReactNode;
}

interface Props {
  /** Most-used action — renders as the primary half of the button. */
  primary: SplitButtonAction;
  /** Secondary actions revealed in the chevron menu. */
  actions: SplitButtonAction[];
  className?: string;
}

/**
 * SplitButton — primary action on the left, chevron on the right that
 * opens a dropdown of related secondary actions. Linear-style.
 */
export default function SplitButton({ primary, actions, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function PrimaryChunk() {
    const inner = (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-l-md bg-[#0B1F3A] px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-95">
        {primary.icon}
        {primary.label}
      </span>
    );
    if (primary.href) return <Link href={primary.href}>{inner}</Link>;
    return (
      <button type="button" onClick={primary.onClick}>
        {inner}
      </button>
    );
  }

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <PrimaryChunk />
      <span className="w-px bg-white/20" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-r-md bg-[#0B1F3A] text-white transition-opacity hover:opacity-95"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-md border border-zinc-200/85 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="py-1">
            {actions.map((a, i) => {
              const inner = (
                <span className="flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50">
                  {a.icon && (
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-zinc-500">
                      {a.icon}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium text-zinc-900">
                      {a.label}
                    </span>
                    {a.description && (
                      <span className="mt-0.5 block text-[11.5px] text-zinc-500">
                        {a.description}
                      </span>
                    )}
                  </span>
                </span>
              );
              if (a.href) {
                return (
                  <Link key={i} href={a.href} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    a.onClick?.();
                    setOpen(false);
                  }}
                  className="block w-full"
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

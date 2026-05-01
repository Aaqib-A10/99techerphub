import React from 'react';

/**
 * Mono-font code chip. Used for empCodes (TST-001), asset tags
 * (99T-LAPTOP-0001), and company codes (99TECH / MSC / PCMART / SJ).
 *
 * Neutral (no accent) — meant to disappear into the row and let the
 * value carry the meaning.
 */
interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function Tag({ children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] bg-core-surface2 px-[6px] py-[2px] font-mono text-[10px] font-semibold text-core-text2 ${className}`}
      style={{ letterSpacing: '0.04em' }}
    >
      {children}
    </span>
  );
}

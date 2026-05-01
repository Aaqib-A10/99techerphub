import React from 'react';

/**
 * PageHero — quiet page header for list/detail pages.
 *
 * Now driven by 99Core design tokens (Phase 3+) so every page that uses
 * this component picks up the new look automatically. Eyebrow / title /
 * subtitle pattern matches the design handoff:
 *   eyebrow: 10.5px uppercase 0.09em tracked text-core-text3
 *   title:   22px semibold text-core-text -0.018em tracking
 *   desc:    13px text-core-text2
 */
export default function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="text-[22px] font-semibold leading-tight text-core-text"
          style={{ letterSpacing: '-0.018em' }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-[2px] max-w-[820px] text-[13px] text-core-text2">
            {description}
          </p>
        )}
        {children}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

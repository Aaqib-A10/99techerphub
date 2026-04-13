import React from 'react';

/**
 * PageHero — Architectural Ledger header for list/detail pages.
 *
 * Navy gradient banner with a 2px teal "Ledger Line" on the left edge,
 * optional monospaced eyebrow label, title, description, and a right-side
 * actions slot for CTAs (buttons, links).
 *
 * Usage:
 *   <PageHero
 *     eyebrow="Module / Section"
 *     title="Employees"
 *     description="Manage employee lifecycle from offer to exit"
 *     actions={
 *       <>
 *         <Link href="/employees/import" className="btn btn-secondary">Bulk Import</Link>
 *         <Link href="/employees/new" className="btn btn-accent">Add Employee</Link>
 *       </>
 *     }
 *   />
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
    <div
      className="page-hero"
      style={{
        background: 'linear-gradient(135deg, #0B1F3A 0%, #152B4C 100%)',
      }}
    >
      {/* Ambient teal glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0) 65%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div
              className="eyebrow"
              style={{
                color: '#14B8A6',
                marginBottom: 8,
                display: 'inline-block',
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="text-3xl md:text-4xl font-black tracking-tight"
            style={{
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: description ? 6 : 0,
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-sm md:text-base"
              style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4 }}
            >
              {description}
            </p>
          )}
          {children}
        </div>

        {actions && (
          <div className="flex gap-3 flex-wrap items-center" style={{ zIndex: 2 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

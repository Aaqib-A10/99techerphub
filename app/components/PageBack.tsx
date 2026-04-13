'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';

/**
 * PageBack — global back navigation shown on every sub-page.
 * Matches the Architectural Ledger design system.
 */
export default function PageBack() {
  const router = useRouter();
  const pathname = usePathname() || '/';

  const crumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const out: { label: string; href: string }[] = [];
    let acc = '';
    for (const seg of segments) {
      acc += '/' + seg;
      out.push({ label: prettify(seg), href: acc });
    }
    return out;
  }, [pathname]);

  // Don't show on top-level routes, the login page, or the print label page
  if (crumbs.length <= 1 || pathname === '/login') return null;

  return (
    <div
      className="no-print mb-4 flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: 'rgba(11,31,58,0.03)',
        border: '1px solid rgba(196,198,206,0.2)',
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        title="Go back"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all"
        style={{
          color: '#0B1F3A',
          background: '#FFFFFF',
          border: '1px solid rgba(196,198,206,0.4)',
          boxShadow: '0 1px 3px rgba(11,31,58,0.06)',
        }}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <span style={{ height: 16, width: 1, background: 'rgba(196,198,206,0.4)' }} aria-hidden />

      <nav className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap" style={{ fontSize: '0.8rem', color: '#75777E' }}>
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors"
          style={{ color: '#75777E' }}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1.5">
            <span style={{ color: 'rgba(196,198,206,0.6)' }} aria-hidden>›</span>
            {i === crumbs.length - 1 ? (
              <span
                className="mono rounded-md px-2 py-0.5"
                style={{
                  fontWeight: 600,
                  color: '#14B8A6',
                  background: 'rgba(20,184,166,0.08)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.02em',
                }}
              >
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="rounded-md px-1.5 py-0.5 transition-colors" style={{ color: '#75777E' }}>
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

function prettify(seg: string): string {
  // numeric segment → "#id"
  if (/^\d+$/.test(seg)) return `#${seg}`;
  // kebab/underscore → Title Case
  return seg
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const PRESETS = [
  { id: 'all', label: 'All time', days: null as number | null },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: 'ytd', label: 'Year to date', days: -1 }, // special handling
] as const;

/**
 * DateFilter — single chip with a popover for preset ranges + custom range.
 * Reads/writes the `from` and `to` query params via the URL.
 */
export default function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';

  // Decide which preset (if any) is currently active
  function getActivePreset() {
    if (!currentFrom && !currentTo) return 'all';
    const now = new Date();
    if (currentFrom && !currentTo) {
      const from = new Date(currentFrom);
      const days = Math.round((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      const ytdStart = new Date(now.getFullYear(), 0, 1);
      const ytdDays = Math.round(
        (now.getTime() - ytdStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (Math.abs(days - 7) <= 1) return '7d';
      if (Math.abs(days - 30) <= 1) return '30d';
      if (Math.abs(days - 90) <= 1) return '90d';
      if (Math.abs(days - ytdDays) <= 1) return 'ytd';
    }
    return 'custom';
  }

  const active = getActivePreset();
  const activeLabel =
    PRESETS.find((p) => p.id === active)?.label ||
    (currentFrom && currentTo
      ? `${formatShort(currentFrom)} → ${formatShort(currentTo)}`
      : currentFrom
        ? `From ${formatShort(currentFrom)}`
        : 'Custom range');
  const isFiltered = active !== 'all';

  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);
  useEffect(() => {
    setCustomFrom(currentFrom);
    setCustomTo(currentTo);
  }, [currentFrom, currentTo]);

  // Outside-click close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function buildUrl(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('from', from);
    else params.delete('from');
    if (to) params.set('to', to);
    else params.delete('to');
    params.delete('page');
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function applyPreset(id: string) {
    const now = new Date();
    if (id === 'all') {
      router.push(buildUrl('', ''));
    } else if (id === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1);
      router.push(buildUrl(toIsoDate(start), ''));
    } else {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset || preset.days == null || preset.days < 0) return;
      const start = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
      router.push(buildUrl(toIsoDate(start), ''));
    }
    setOpen(false);
  }

  function applyCustom() {
    router.push(buildUrl(customFrom, customTo));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border bg-white pl-2.5 pr-1.5 text-[12.5px] font-medium transition-all duration-150 ${
          isFiltered
            ? 'border-zinc-300 text-zinc-900 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]'
            : 'border-zinc-200/95 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-zinc-400" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4 M8 2v4 M3 10h18" />
        </svg>
        <span className="truncate max-w-[180px]">{activeLabel}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
          className={`text-zinc-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-zinc-200/85 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]">
          <div className="py-1">
            {PRESETS.map((p) => {
              const isActive = active === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                    isActive
                      ? 'bg-zinc-50 font-medium text-zinc-900'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <span>{p.label}</span>
                  {isActive && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50/40 px-3 py-2.5">
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
              Custom range
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 w-full min-w-0 rounded border border-zinc-200 bg-white px-1.5 text-[11.5px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
              <span className="text-[11px] text-zinc-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 w-full min-w-0 rounded border border-zinc-200 bg-white px-1.5 text-[11.5px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={applyCustom}
                disabled={!customFrom && !customTo}
                className="inline-flex h-7 items-center rounded bg-[#0B1F3A] px-3 text-[11.5px] font-medium text-white transition-opacity hover:opacity-95 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
function formatShort(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y.slice(2)}`;
}

'use client';

/**
 * 99Core — "Inventory Audit" prototype
 * Linear / Vercel / Apple inspired. Off-white canvas, hairline dividers,
 * deep charcoal type, single accent reserved for CTAs and active state.
 *
 * Self-contained — no external icon libs. SVG strokes inline.
 */

import { useMemo, useState } from 'react';

// ────────────────────────────────────────────────────────────────────
// Tokens
// ────────────────────────────────────────────────────────────────────
const ACCENT = '#1F2320'; // deep ink — used for CTAs only
const ACCENT_TEAL = '#8FBF3F'; // micro accent for live state

// ────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────
function Icon({
  d,
  size = 18,
  strokeWidth = 1.5,
  className = '',
}: {
  d: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  inventory: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
  audits: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  customers: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  reports: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  search: 'M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  plus: 'M12 5v14 M5 12h14',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  more: 'M12 13a1 1 0 100-2 1 1 0 000 2z M19 13a1 1 0 100-2 1 1 0 000 2z M5 13a1 1 0 100-2 1 1 0 000 2z',
  sort: 'M3 6h18 M7 12h10 M11 18h2',
  command: 'M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z',
};

// ────────────────────────────────────────────────────────────────────
// Sparkline
// ────────────────────────────────────────────────────────────────────
function Sparkline({
  values,
  color = '#1F2320',
  width = 96,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y] as const;
    });
    // Catmull-Rom-ish smoothing → cubic bezier
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const cx = (x1 + x2) / 2;
      d += ` Q ${cx} ${y1} ${cx} ${(y1 + y2) / 2}`;
      d += ` Q ${cx} ${y2} ${x2} ${y2}`;
    }
    return d;
  }, [values, width, height]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// Status Badge (muted tints, high-contrast text)
// ────────────────────────────────────────────────────────────────────
type Status = 'Received' | 'Audited' | 'Sold' | 'Flagged' | 'Disposed' | 'In Transit';
const STATUS_STYLES: Record<Status, string> = {
  Received: 'bg-core-surface2 text-core-text2 ring-core-border',
  Audited: 'bg-core-blueSoft text-core-blueFg ring-blue-100',
  Sold: 'bg-core-greenSoft text-core-greenFg ring-core-greenFg',
  Flagged: 'bg-core-amberSoft text-core-amberFg ring-amber-100',
  Disposed: 'bg-core-roseSoft text-core-roseFg ring-rose-100',
  'In Transit': 'bg-core-violetSoft text-core-violetFg ring-violet-100',
};
function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sample data
// ────────────────────────────────────────────────────────────────────
type Row = {
  tag: string;
  device: string;
  model: string;
  customer: string;
  status: Status;
  auditedAt: string;
  recovery: number;
  grade: 'A' | 'B' | 'C' | '—';
};
const ROWS: Row[] = [
  { tag: '99T-LAP-2401', device: 'Laptop', model: 'MacBook Pro 14" M3', customer: 'Northwind Holdings', status: 'Audited', auditedAt: 'Apr 27', recovery: 1240, grade: 'A' },
  { tag: '99T-LAP-2402', device: 'Laptop', model: 'Dell Latitude 7430', customer: 'Acme Industrial', status: 'Sold', auditedAt: 'Apr 26', recovery: 480, grade: 'B' },
  { tag: '99T-CHR-2403', device: 'Chromebook', model: 'HP Chromebook 14', customer: 'Eagan School Dist.', status: 'Received', auditedAt: '—', recovery: 0, grade: '—' },
  { tag: '99T-SRV-2404', device: 'Server', model: 'Dell PowerEdge R740', customer: 'Helix Capital', status: 'Flagged', auditedAt: 'Apr 25', recovery: 0, grade: 'C' },
  { tag: '99T-LAP-2405', device: 'Laptop', model: 'ThinkPad X1 Carbon Gen 11', customer: 'Northwind Holdings', status: 'Audited', auditedAt: 'Apr 25', recovery: 690, grade: 'A' },
  { tag: '99T-MON-2406', device: 'Monitor', model: 'LG UltraFine 27"', customer: 'Boreal Logistics', status: 'In Transit', auditedAt: '—', recovery: 0, grade: '—' },
  { tag: '99T-CHR-2407', device: 'Chromebook', model: 'Lenovo 300e', customer: 'Eagan School Dist.', status: 'Disposed', auditedAt: 'Apr 24', recovery: 12, grade: 'C' },
  { tag: '99T-LAP-2408', device: 'Laptop', model: 'Surface Laptop 5', customer: 'Acme Industrial', status: 'Sold', auditedAt: 'Apr 23', recovery: 540, grade: 'B' },
  { tag: '99T-SRV-2409', device: 'Server', model: 'HPE ProLiant DL380', customer: 'Helix Capital', status: 'Audited', auditedAt: 'Apr 23', recovery: 2100, grade: 'A' },
  { tag: '99T-LAP-2410', device: 'Laptop', model: 'MacBook Air 13" M2', customer: 'Boreal Logistics', status: 'Received', auditedAt: '—', recovery: 0, grade: '—' },
];

const SPARK_PROCESSED = [12, 18, 14, 22, 19, 26, 24, 31, 28, 36, 33, 41];
const SPARK_RECOVERY = [40, 38, 44, 49, 46, 51, 55, 53, 60, 64, 67, 72];
const SPARK_AUDITS = [3, 4, 4, 6, 5, 7, 6, 8, 9, 8, 10, 11];
const SPARK_FLAGGED = [2, 1, 2, 3, 1, 2, 4, 3, 2, 3, 2, 1];

// ────────────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────────────
function Sidebar({ active = 'inventory' as keyof typeof ICONS }) {
  const items: Array<{ key: keyof typeof ICONS; label: string }> = [
    { key: 'dashboard', label: 'Overview' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'audits', label: 'Audits' },
    { key: 'customers', label: 'Customers' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-14 border-r border-core-border/70 bg-[#F7F8F4] flex flex-col items-center py-3">
      {/* Wordmark */}
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1F2320] text-white text-[11px] font-semibold tracking-tight">
        99
      </div>

      <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              type="button"
              title={it.label}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-md text-core-text3 transition-all duration-200 hover:text-core-text hover:bg-core-border/60 ${
                isActive ? 'text-core-text bg-core-surface shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]' : ''
              }`}
            >
              {isActive && (
                <span className="absolute -left-1.5 h-4 w-[2px] rounded-r-full bg-[#1F2320]" />
              )}
              <Icon d={ICONS[it.key]} size={17} strokeWidth={1.5} />
              {/* Hover label */}
              <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-core-text px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {it.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Avatar */}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-core-border text-[11px] font-medium text-core-text2 transition-opacity hover:opacity-80"
        title="Asim Khan"
      >
        AK
      </button>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────
// Topbar
// ────────────────────────────────────────────────────────────────────
function Topbar() {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-core-border/70 bg-[#F7F8F4]/90 backdrop-blur supports-[backdrop-filter]:bg-[#F7F8F4]/70">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-core-text3">99Core</span>
          <Icon d={ICONS.chevronRight} size={14} className="text-core-text3" />
          <span className="text-core-text3">Inventory</span>
          <Icon d={ICONS.chevronRight} size={14} className="text-core-text3" />
          <span className="font-medium text-core-text">Audit</span>
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2">
          <div className="group relative hidden sm:flex h-8 w-72 items-center rounded-md border border-core-border/80 bg-core-surface pl-2.5 pr-1.5 transition-all duration-200 hover:border-core-border focus-within:border-zinc-400 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]">
            <Icon d={ICONS.search} size={14} className="text-core-text3" />
            <input
              type="text"
              placeholder="Search assets, audits, customers…"
              className="ml-2 flex-1 bg-transparent text-[13px] text-core-text placeholder:text-core-text3 focus:outline-none"
            />
            <kbd className="inline-flex items-center gap-0.5 rounded border border-core-border px-1 py-0.5 font-mono text-[10px] text-core-text3">
              ⌘K
            </kbd>
          </div>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-core-text3 transition-colors hover:bg-core-surface2 hover:text-core-text"
            title="Notifications"
          >
            <Icon d={ICONS.bell} size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPI Card
// ────────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  delta,
  trend,
  spark,
  unit,
  positive = true,
}: {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  spark: number[];
  unit?: string;
  positive?: boolean;
}) {
  const trendColor =
    trend === 'flat'
      ? 'text-core-text3'
      : positive
        ? 'text-core-greenFg'
        : 'text-core-roseFg';
  return (
    <div className="rounded-lg bg-core-surface p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] transition-shadow duration-300 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-core-text3">
          {label}
        </p>
        <button className="-mr-1 -mt-1 rounded p-1 text-core-text3 transition-opacity hover:opacity-70">
          <Icon d={ICONS.more} size={14} />
        </button>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold tracking-tight text-core-text tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-core-text3">{unit}</span>}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className={`text-[11px] font-medium ${trendColor}`}>{delta}</span>
        <Sparkline values={spark} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Table
// ────────────────────────────────────────────────────────────────────
function InventoryTable() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = selected.size === ROWS.length;

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ROWS.map((r) => r.tag)));
  }

  return (
    <div className="overflow-hidden rounded-lg bg-core-surface shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-core-border px-5 py-3">
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <span className="text-[12px] text-core-text2">
              <span className="font-medium text-core-text tabular-nums">{selected.size}</span> selected
            </span>
          ) : (
            <>
              {(['All', 'Received', 'Audited', 'Sold', 'Flagged'] as const).map((chip, i) => (
                <button
                  key={chip}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 ${
                    i === 0
                      ? 'bg-core-surface2 text-core-text'
                      : 'text-core-text3 hover:bg-core-surface2 hover:text-core-text'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-core-text2 transition-colors hover:bg-core-surface2 hover:text-core-text">
            <Icon d={ICONS.filter} size={13} />
            Filter
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-core-text2 transition-colors hover:bg-core-surface2 hover:text-core-text">
            <Icon d={ICONS.sort} size={13} />
            Sort
          </button>
          <span className="mx-1 h-4 w-px bg-core-border" />
          <button className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-core-text2 transition-colors hover:bg-core-surface2 hover:text-core-text">
            <Icon d={ICONS.download} size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[36px_minmax(140px,1fr)_minmax(160px,1.4fr)_minmax(160px,1.2fr)_120px_90px_120px_36px] gap-4 border-b border-core-border px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-core-text3">
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5 cursor-pointer rounded border-core-border text-core-text focus:ring-0 focus:ring-offset-0"
          />
        </div>
        <div>Asset Tag</div>
        <div>Device / Model</div>
        <div>Customer</div>
        <div>Status</div>
        <div>Grade</div>
        <div className="text-right">Recovery</div>
        <div></div>
      </div>

      {/* Rows */}
      <div>
        {ROWS.map((r) => {
          const isSel = selected.has(r.tag);
          return (
            <div
              key={r.tag}
              className={`group grid grid-cols-[36px_minmax(140px,1fr)_minmax(160px,1.4fr)_minmax(160px,1.2fr)_120px_90px_120px_36px] gap-4 border-b border-zinc-50 px-5 py-3 text-[13px] transition-colors duration-150 ${
                isSel ? 'bg-core-surface2/60' : 'hover:bg-core-surface2/40'
              }`}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(r.tag)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-core-border text-core-text focus:ring-0 focus:ring-offset-0"
                />
              </div>
              <div className="flex items-center font-mono text-[12px] tracking-tight text-core-text">
                {r.tag}
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-medium text-core-text">{r.device}</span>
                <span className="mt-0.5 text-[11.5px] text-core-text3">{r.model}</span>
              </div>
              <div className="flex items-center text-core-text2">{r.customer}</div>
              <div className="flex items-center">
                <StatusBadge status={r.status} />
              </div>
              <div className="flex items-center">
                {r.grade === '—' ? (
                  <span className="text-core-text3">—</span>
                ) : (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-core-surface2 px-1.5 text-[11px] font-semibold text-core-text2">
                    {r.grade}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end font-mono tabular-nums text-core-text">
                {r.recovery > 0 ? `$${r.recovery.toLocaleString()}` : <span className="text-core-text3">—</span>}
              </div>
              <div className="flex items-center justify-end">
                <button className="rounded p-1 text-core-text3 opacity-0 transition-opacity duration-150 hover:bg-core-surface2 hover:text-core-text group-hover:opacity-100">
                  <Icon d={ICONS.more} size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 text-[12px] text-core-text3">
        <span>
          Showing <span className="font-medium text-core-text tabular-nums">10</span> of{' '}
          <span className="font-medium text-core-text tabular-nums">2,847</span> assets
        </span>
        <div className="flex items-center gap-1">
          <button className="rounded px-2 py-1 transition-colors hover:bg-core-surface2 hover:text-core-text">Previous</button>
          <button className="rounded bg-core-surface2 px-2 py-1 font-medium text-core-text">1</button>
          <button className="rounded px-2 py-1 transition-colors hover:bg-core-surface2 hover:text-core-text">2</button>
          <button className="rounded px-2 py-1 transition-colors hover:bg-core-surface2 hover:text-core-text">3</button>
          <span className="px-1 text-core-text3">…</span>
          <button className="rounded px-2 py-1 transition-colors hover:bg-core-surface2 hover:text-core-text">285</button>
          <button className="rounded px-2 py-1 transition-colors hover:bg-core-surface2 hover:text-core-text">Next</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────
export default function InventoryAuditLab() {
  const [toast, setToast] = useState<string | null>(null);
  function fireToast() {
    setToast('Export queued · 2,847 rows');
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div className="min-h-screen bg-[#F7F8F4] font-sans text-core-text antialiased">
      <Sidebar active="inventory" />

      <div className="pl-14">
        <Topbar />

        <main className="mx-auto max-w-[1280px] px-8 py-10">
          {/* Page header */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-core-text">
                  Inventory Audit
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-core-surface px-2 py-0.5 text-[11px] font-medium text-core-text2 ring-1 ring-core-border/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                      style={{ backgroundColor: ACCENT_TEAL }}
                    />
                    <span
                      className="relative inline-flex h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ACCENT_TEAL }}
                    />
                  </span>
                  Live
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-core-text3">
                Hardware moving through receive, audit, grade, and resale.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fireToast}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-core-border/80 bg-core-surface px-3 text-[13px] font-medium text-core-text2 transition-all duration-200 hover:border-core-border hover:bg-core-surface2"
              >
                <Icon d={ICONS.download} size={13} />
                Export
              </button>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-white transition-all duration-200 hover:opacity-90 active:opacity-100"
                style={{ backgroundColor: ACCENT }}
              >
                <Icon d={ICONS.plus} size={13} />
                New audit
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Assets Processed"
              value="2,847"
              delta="+12.4% this month"
              trend="up"
              spark={SPARK_PROCESSED}
            />
            <KpiCard
              label="Recovery Value"
              value="$184.2K"
              delta="+8.1% vs last month"
              trend="up"
              spark={SPARK_RECOVERY}
            />
            <KpiCard
              label="Active Audits"
              value="42"
              delta="11 due this week"
              trend="flat"
              spark={SPARK_AUDITS}
            />
            <KpiCard
              label="Flagged Units"
              value="7"
              delta="−3 since last week"
              trend="down"
              spark={SPARK_FLAGGED}
              positive={true}
            />
          </div>

          {/* Table */}
          <div className="mt-8">
            <InventoryTable />
          </div>
        </main>
      </div>

      {/* Toast */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <div className="flex items-center gap-3 rounded-lg bg-core-text px-4 py-2.5 text-[13px] text-white shadow-2xl">
          <span className="flex h-1.5 w-1.5 rounded-full bg-core-green" />
          <span>{toast}</span>
        </div>
      </div>
    </div>
  );
}

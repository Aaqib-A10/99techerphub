'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from './design';

/**
 * Dashboard card: monthly approved-expense trend with selectable
 * range. PKR and USD are shown as separate bar series — no FX
 * conversion. The chart is a tiny self-contained SVG so we don't
 * need to pull in a charting library.
 */

type Range = '1m' | '3m' | '1y' | 'custom';

interface Bucket {
  month: string;
  pkr: number;
  usd: number;
  count: number;
}

interface TrendResponse {
  range: { from: string; to: string };
  buckets: Bucket[];
}

const RANGE_LABELS: Record<Range, string> = {
  '1m': '1 month',
  '3m': '3 months',
  '1y': '1 year',
  custom: 'Custom',
};

function isoMonthAdd(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeToParams(range: Range, customFrom: string, customTo: string) {
  const now = new Date();
  if (range === 'custom') return { from: customFrom, to: customTo };
  if (range === '1m') {
    const from = isoMonthAdd(now, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmtIso(from), to: fmtIso(to) };
  }
  if (range === '3m') {
    const from = isoMonthAdd(now, -2);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmtIso(from), to: fmtIso(to) };
  }
  // 1y
  const from = isoMonthAdd(now, -11);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmtIso(from), to: fmtIso(to) };
}

function fmtMonthShort(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map((s) => parseInt(s));
  return new Date(y, m - 1, 1).toLocaleString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function fmtAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString();
}

export default function ExpenseTrendCard() {
  const [range, setRange] = useState<Range>('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { from, to } = rangeToParams(range, customFrom, customTo);
        if (range === 'custom' && (!from || !to)) {
          if (!cancelled) {
            setData({ range: { from: '', to: '' }, buckets: [] });
            setLoading(false);
          }
          return;
        }
        const url = `/api/dashboard/expense-trend?from=${from}&to=${to}`;
        const res = await fetch(url);
        const raw = await res.text();
        let payload: any = {};
        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = { error: raw.slice(0, 200) };
          }
        }
        if (!res.ok)
          throw new Error(payload?.error || `Failed (HTTP ${res.status})`);
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, customFrom, customTo]);

  const buckets = data?.buckets ?? [];

  const totals = useMemo(() => {
    let pkr = 0;
    let usd = 0;
    for (const b of buckets) {
      pkr += b.pkr;
      usd += b.usd;
    }
    return { pkr, usd };
  }, [buckets]);

  return (
    <Card
      title="Expense trend"
      subtitle={
        loading
          ? 'Loading…'
          : data?.range.from && data?.range.to
            ? `${data.range.from} → ${data.range.to} · ${buckets.length} months`
            : 'Pick a range to view'
      }
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          {(['1m', '3m', '1y', 'custom'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition ${
                range === r
                  ? 'bg-core-text text-core-surface'
                  : 'text-core-text2 hover:bg-core-surface2'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      }
      padded
    >
      {range === 'custom' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-core-text3">
            Period
          </span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 rounded-md border border-core-border bg-core-surface px-2 text-[12px]"
          />
          <span className="text-core-text3">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 rounded-md border border-core-border bg-core-surface px-2 text-[12px]"
          />
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md bg-core-roseSoft p-2 text-[12px] text-core-roseFg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SeriesChart
          title="PKR"
          accent="#1F6F4A"
          accentSoft="rgba(31,111,74,0.18)"
          buckets={buckets}
          pick={(b) => b.pkr}
          total={totals.pkr}
          currency="PKR"
        />
        <SeriesChart
          title="USD"
          accent="#2C6FBA"
          accentSoft="rgba(44,111,186,0.18)"
          buckets={buckets}
          pick={(b) => b.usd}
          total={totals.usd}
          currency="USD"
        />
      </div>
    </Card>
  );
}

// ─────────────────────────── Single-series chart ───────────────────

function SeriesChart({
  title,
  accent,
  accentSoft,
  buckets,
  pick,
  total,
  currency,
}: {
  title: string;
  accent: string;
  accentSoft: string;
  buckets: Bucket[];
  pick: (b: Bucket) => number;
  total: number;
  currency: string;
}) {
  // SVG dimensions; we draw within a fixed viewBox so the layout is
  // responsive without breaking proportions.
  const vbW = 320;
  const vbH = 120;
  const padL = 28;
  const padR = 6;
  const padT = 8;
  const padB = 22;
  const innerW = vbW - padL - padR;
  const innerH = vbH - padT - padB;

  const max = Math.max(1, ...buckets.map(pick));
  const barCount = buckets.length || 1;
  const slot = innerW / barCount;
  const barW = Math.max(2, slot * 0.6);

  return (
    <div className="rounded-lg border border-core-border bg-core-surface2 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-core-text3">
          {title}
        </div>
        <div className="font-mono text-[12px] font-semibold text-core-text">
          {currency} {fmtAmount(total)}
        </div>
      </div>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-[150px] w-full">
        {/* y-axis baseline */}
        <line
          x1={padL}
          y1={padT + innerH}
          x2={vbW - padR}
          y2={padT + innerH}
          stroke="#C9CFC0"
          strokeWidth={0.6}
        />
        {/* y-axis max label */}
        <text
          x={4}
          y={padT + 8}
          fontSize={8}
          fill="#5A6159"
          fontFamily="JetBrains Mono, monospace"
        >
          {fmtAmount(max)}
        </text>
        <text
          x={4}
          y={padT + innerH + 3}
          fontSize={8}
          fill="#5A6159"
          fontFamily="JetBrains Mono, monospace"
        >
          0
        </text>

        {buckets.map((b, i) => {
          const v = pick(b);
          const h = v > 0 ? Math.max(1, (v / max) * innerH) : 0;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = padT + innerH - h;
          return (
            <g key={b.month}>
              {/* track */}
              <rect
                x={x}
                y={padT}
                width={barW}
                height={innerH}
                fill={accentSoft}
                rx={1.5}
                opacity={v > 0 ? 0.4 : 0.2}
              />
              {/* bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={accent}
                rx={1.5}
              >
                <title>{`${fmtMonthShort(b.month)}: ${currency} ${Math.round(v).toLocaleString()}`}</title>
              </rect>
              {/* x-tick label — show every other one when crowded */}
              {(barCount <= 6 || i % 2 === 0) && (
                <text
                  x={padL + i * slot + slot / 2}
                  y={vbH - 6}
                  fontSize={8}
                  fill="#5A6159"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {fmtMonthShort(b.month)}
                </text>
              )}
            </g>
          );
        })}

        {buckets.length === 0 && (
          <text
            x={vbW / 2}
            y={vbH / 2}
            fontSize={10}
            fill="#8B918A"
            textAnchor="middle"
            fontStyle="italic"
          >
            No data in this range
          </text>
        )}
      </svg>
    </div>
  );
}

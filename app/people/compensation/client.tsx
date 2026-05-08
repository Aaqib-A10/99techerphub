'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, KpiTile, Badge } from '@/app/components/design';
import {
  ColumnDef,
  downloadCsv,
  openPrintReport,
} from '@/lib/reportExport';

/**
 * Compensation register — one row per active employee with their
 * current salary snapshot + YTD totals. Click a row to drill into
 * that employee's Compensation tab.
 *
 * No period filter on this page — it's a snapshot ("here's the
 * comp state today"), not a time-series. The CSV/PDF buttons export
 * exactly what the user sees.
 */

interface RegisterRow {
  employeeId: number;
  empCode: string;
  name: string;
  designation: string | null;
  isActive: boolean;
  monthlyPayablePkr: number;
  monthlyPayableUsd: number;
  department: { id: number; name: string } | null;
  currentBase: number | null;
  currentCurrency: string | null;
  lastRaise: {
    effectiveFrom: string;
    incrementPct: number | null;
    previousBase: number;
  } | null;
  ytdBonusPkr: number;
  ytdBonusUsd: number;
  ytdCommissionPkr: number;
  ytdCommissionUsd: number;
}

export default function CompensationRegisterClient({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  // Default off — most views are "people we pay today". Toggle on to
  // pull off-boarded employees too (HR archive use case).
  const [includeInactive, setIncludeInactive] = useState(false);
  // Click a Monthly Base KPI tile to scope the table to that
  // currency. 'all' = no scope. Same tile clicked twice clears.
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'PKR' | 'USD'>('all');
  // Period for the "Monthly payable" column. Defaults to current
  // month so HR sees this month's totals without picking.
  const [payablePeriod, setPayablePeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (includeInactive) params.set('includeInactive', '1');
        if (payablePeriod) params.set('period', payablePeriod);
        const url = `/api/compensation/register?${params.toString()}`;
        const res = await fetch(url);
        // Read as text first so a 500 with an empty body doesn't
        // surface as "Unexpected end of JSON input" — we'd rather
        // show the HTTP status to the user.
        const raw = await res.text();
        let data: any = [];
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = { error: raw.slice(0, 200) };
          }
        }
        if (!res.ok) {
          throw new Error(
            (data?.error as string) ||
              `Failed to load (HTTP ${res.status}). The server didn't return a message.`,
          );
        }
        // API now returns { period, rows } — older shape was a bare
        // array. Handle both for forward compatibility.
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : [];
        if (!cancelled) setRows(list);
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
  }, [includeInactive, payablePeriod]);

  const departments = useMemo(() => {
    const set = new Map<number, string>();
    for (const r of rows) {
      if (r.department) set.set(r.department.id, r.department.name);
    }
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // Two-stage filter: `scoped` honors search + department only and
  // drives the KPI tiles (so clicking PKR doesn't zero out the USD
  // tile). `filtered` further applies the currency scope and drives
  // the table.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (department && String(r.department?.id ?? '') !== department)
        return false;
      if (!q) return true;
      const hay = `${r.name} ${r.empCode} ${r.designation ?? ''} ${r.department?.name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, department]);

  const filtered = useMemo(() => {
    if (currencyFilter === 'all') return scoped;
    // "no salary on record" rows are excluded from any specific-
    // currency scope.
    return scoped.filter((r) => r.currentCurrency === currencyFilter);
  }, [scoped, currencyFilter]);

  // KPI strip: a quick read on the org-wide compensation footprint.
  // PKR and USD totals are kept separate (no FX conversion). Counts
  // are per-currency too — "121 employees on PKR payroll" used to
  // misreport the total across both currencies.
  const kpis = useMemo(() => {
    let basePkr = 0;
    let baseUsd = 0;
    let pkrCount = 0;
    let usdCount = 0;
    let bonusPkr = 0;
    let bonusUsd = 0;
    // Driven by `scoped` so clicking the PKR tile to filter the table
    // doesn't make the USD tile read 0 — the tiles always reflect
    // the search+department slice, currency-filter is applied below.
    for (const r of scoped) {
      if (r.currentBase != null) {
        if (r.currentCurrency === 'USD') {
          baseUsd += r.currentBase;
          usdCount++;
        } else {
          basePkr += r.currentBase;
          pkrCount++;
        }
      }
      bonusPkr += r.ytdBonusPkr;
      bonusUsd += r.ytdBonusUsd;
    }
    return { basePkr, baseUsd, pkrCount, usdCount, bonusPkr, bonusUsd };
  }, [scoped]);

  const exportColumns: ColumnDef<RegisterRow>[] = [
    { header: 'Code', value: (r) => r.empCode },
    { header: 'Name', value: (r) => r.name },
    { header: 'Designation', value: (r) => r.designation ?? '' },
    { header: 'Department', value: (r) => r.department?.name ?? '' },
    {
      header: 'Current Base',
      value: (r) =>
        r.currentBase != null ? Number(r.currentBase).toLocaleString() : '',
      align: 'right',
    },
    { header: 'Currency', value: (r) => r.currentCurrency ?? '' },
    {
      header: 'Last Raise',
      value: (r) =>
        r.lastRaise
          ? new Date(r.lastRaise.effectiveFrom).toLocaleDateString()
          : '',
    },
    {
      header: 'Raise %',
      value: (r) =>
        r.lastRaise?.incrementPct != null
          ? r.lastRaise.incrementPct.toFixed(1)
          : '',
      align: 'right',
    },
    {
      header: 'YTD Bonus PKR',
      value: (r) => r.ytdBonusPkr || '',
      align: 'right',
    },
    {
      header: 'YTD Bonus USD',
      value: (r) => r.ytdBonusUsd || '',
      align: 'right',
    },
    {
      header: 'YTD Commission PKR',
      value: (r) => r.ytdCommissionPkr || '',
      align: 'right',
    },
    {
      header: 'YTD Commission USD',
      value: (r) => r.ytdCommissionUsd || '',
      align: 'right',
    },
    {
      header: `${payablePeriod} Payable PKR`,
      value: (r) => Math.round(r.monthlyPayablePkr) || '',
      align: 'right',
    },
    {
      header: `${payablePeriod} Payable USD`,
      value: (r) => Math.round(r.monthlyPayableUsd) || '',
      align: 'right',
    },
  ];

  const today = new Date().toISOString().slice(0, 10);

  const handleCsv = () => {
    downloadCsv(`compensation_${today}.csv`, filtered, exportColumns);
  };

  const handlePdf = () => {
    openPrintReport({
      title: 'Compensation Register',
      subtitle:
        department || search
          ? `${filtered.length} employees (filtered)`
          : `${filtered.length} active employees`,
      rows: filtered,
      columns: exportColumns,
      totals: [
        {
          label: 'Total Monthly Base (PKR)',
          value: `PKR ${kpis.basePkr.toLocaleString()}`,
        },
        {
          label: 'Total Monthly Base (USD)',
          value: `USD ${kpis.baseUsd.toLocaleString()}`,
        },
        {
          label: 'YTD Bonus (PKR)',
          value: `PKR ${kpis.bonusPkr.toLocaleString()}`,
        },
        {
          label: 'YTD Bonus (USD)',
          value: `USD ${kpis.bonusUsd.toLocaleString()}`,
        },
      ],
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div
          className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
          style={{ letterSpacing: '0.09em' }}
        >
          People · Compensation
        </div>
        <h1
          className="text-[22px] font-semibold leading-tight text-core-text"
          style={{ letterSpacing: '-0.018em' }}
        >
          Compensation
        </h1>
        <p className="mt-[2px] text-[13px] text-core-text2">
          Salary, raises, bonuses, and commissions per employee. Click any row
          to drill into the full history.
        </p>
      </div>

      {/* KPI strip — PKR and USD separately, never converted. Counts
          are per-currency. The Monthly Base tiles are clickable
          filters: clicking PKR scopes the table to PKR-paid
          employees; clicking USD switches; clicking the active tile
          again clears. The Bonus tiles are display-only (filtering
          by bonus presence isn't a meaningful slice). */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setCurrencyFilter(currencyFilter === 'PKR' ? 'all' : 'PKR')
          }
          className={`rounded-2xl text-left transition focus:outline-none ${
            currencyFilter === 'PKR'
              ? 'ring-2 ring-core-greenFg/60'
              : 'hover:opacity-90'
          }`}
          title={
            currencyFilter === 'PKR'
              ? 'Click to clear PKR filter'
              : 'Click to filter table to PKR-paid employees'
          }
        >
          <KpiTile
            tone="green"
            label="Monthly base · PKR"
            value={`PKR ${kpis.basePkr.toLocaleString()}`}
            meta={
              kpis.pkrCount === 0
                ? 'No PKR-paid employees'
                : `${kpis.pkrCount} ${kpis.pkrCount === 1 ? 'employee' : 'employees'} on PKR payroll`
            }
          />
        </button>
        <button
          type="button"
          onClick={() =>
            setCurrencyFilter(currencyFilter === 'USD' ? 'all' : 'USD')
          }
          className={`rounded-2xl text-left transition focus:outline-none ${
            currencyFilter === 'USD'
              ? 'ring-2 ring-core-blueFg/60'
              : 'hover:opacity-90'
          }`}
          title={
            currencyFilter === 'USD'
              ? 'Click to clear USD filter'
              : 'Click to filter table to USD-paid employees'
          }
        >
          <KpiTile
            tone="blue"
            label="Monthly base · USD"
            value={`USD ${kpis.baseUsd.toLocaleString()}`}
            meta={
              kpis.usdCount === 0
                ? 'No USD-paid employees'
                : `${kpis.usdCount} ${kpis.usdCount === 1 ? 'employee' : 'employees'} on USD payroll`
            }
          />
        </button>
        <KpiTile
          tone="amber"
          label="YTD bonus · PKR"
          value={`PKR ${kpis.bonusPkr.toLocaleString()}`}
          meta="Calendar year"
        />
        <KpiTile
          tone="violet"
          label="YTD bonus · USD"
          value={`USD ${kpis.bonusUsd.toLocaleString()}`}
          meta="Calendar year"
        />
      </div>

      {/* Filter strip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, code, designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-[280px] rounded-lg border border-core-border bg-core-surface px-3 text-[12.5px] text-core-text"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        >
          <option value="">All departments</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-core-text2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-3.5 w-3.5"
            style={{ accentColor: '#1F2320' }}
          />
          Include inactive
        </label>
        <div className="flex items-center gap-1.5 text-[12.5px] text-core-text2">
          <span className="text-core-text3">Payable period</span>
          <input
            type="month"
            value={payablePeriod}
            onChange={(e) => setPayablePeriod(e.target.value)}
            className="h-9 rounded-lg border border-core-border bg-core-surface px-2"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCsv}
            disabled={filtered.length === 0}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            CSV
          </button>
          <button
            onClick={handlePdf}
            disabled={filtered.length === 0}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      <Card
        title={
          currencyFilter === 'PKR'
            ? 'PKR-paid employees'
            : currencyFilter === 'USD'
              ? 'USD-paid employees'
              : 'All employees'
        }
        subtitle={
          currencyFilter === 'all'
            ? `${filtered.length} of ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`
            : `${filtered.length} ${filtered.length === 1 ? 'employee' : 'employees'} · click the highlighted tile to clear`
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {[
                  'Employee',
                  'Department',
                  'Current Base',
                  'Last Raise',
                  'YTD Bonus',
                  'YTD Commission',
                  `${payablePeriod} Payable`,
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[12px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-core-text3">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-core-text3">
                    No employees match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const isLast = i === filtered.length - 1;
                  return (
                    <tr
                      key={r.employeeId}
                      onClick={() => router.push(`/employees/${r.employeeId}#compensation`)}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className="cursor-pointer transition-colors hover:bg-core-surface2"
                    >
                      <td className="px-[12px] py-[8px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-core-text">
                            {r.name}
                          </span>
                          {!r.isActive && <Badge tone="gray">Inactive</Badge>}
                        </div>
                        <div className="mt-[1px] font-mono text-[10.5px] text-core-text3">
                          {r.empCode}
                          {r.designation ? ` · ${r.designation}` : ''}
                        </div>
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">
                        {r.department?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono">
                        {r.currentBase != null ? (
                          <span className="text-core-text">
                            {r.currentCurrency} {r.currentBase.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {r.lastRaise ? (
                          <div>
                            <span
                              className={`text-[12px] font-semibold ${(r.lastRaise.incrementPct ?? 0) >= 0 ? 'text-core-greenFg' : 'text-core-roseFg'}`}
                            >
                              {r.lastRaise.incrementPct != null
                                ? `${r.lastRaise.incrementPct >= 0 ? '+' : ''}${r.lastRaise.incrementPct.toFixed(1)}%`
                                : '—'}
                            </span>
                            <div className="text-[10.5px] text-core-text3">
                              {new Date(r.lastRaise.effectiveFrom).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] font-mono text-[12px]">
                        {r.ytdBonusPkr || r.ytdBonusUsd ? (
                          <div>
                            {r.ytdBonusPkr ? (
                              <div>PKR {r.ytdBonusPkr.toLocaleString()}</div>
                            ) : null}
                            {r.ytdBonusUsd ? (
                              <div>USD {r.ytdBonusUsd.toLocaleString()}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] font-mono text-[12px]">
                        {r.ytdCommissionPkr || r.ytdCommissionUsd ? (
                          <div>
                            {r.ytdCommissionPkr ? (
                              <div>PKR {r.ytdCommissionPkr.toLocaleString()}</div>
                            ) : null}
                            {r.ytdCommissionUsd ? (
                              <div>USD {r.ytdCommissionUsd.toLocaleString()}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-[12px] font-semibold">
                        {r.monthlyPayablePkr || r.monthlyPayableUsd ? (
                          <div>
                            {r.monthlyPayablePkr ? (
                              <div className="text-core-text">
                                PKR {Math.round(r.monthlyPayablePkr).toLocaleString()}
                              </div>
                            ) : null}
                            {r.monthlyPayableUsd ? (
                              <div className="text-core-text">
                                USD {Math.round(r.monthlyPayableUsd).toLocaleString()}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, KpiTile } from '@/app/components/design';
import {
  ColumnDef,
  downloadCsv,
  openPrintReport,
} from '@/lib/reportExport';

interface Row {
  companyId: number | null;
  companyName: string;
  companyCode: string | null;
  allocatedPkr: number;
  allocatedUsd: number;
  pkrEquivalent: number;
  employeeCount: number;
}

interface Totals {
  pkr: number;
  usd: number;
  pkrEquivalent: number;
  employeesTotal: number;
  employeesWithSalary: number;
  unallocatedPkr: number;
  unallocatedUsd: number;
  fxRate: number;
}

interface Response {
  asOf: string;
  rows: Row[];
  totals: Totals;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CostByCompanyClient() {
  const [asOf, setAsOf] = useState(todayIso());
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await fetch(
          `/api/compensation/cost-by-company?asOf=${asOf}`,
        );
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
          throw new Error(
            (payload?.error as string) ||
              `Failed (HTTP ${res.status})`,
          );
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
  }, [asOf]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const columns: ColumnDef<Row>[] = [
    { header: 'Company', value: (r) => r.companyName },
    { header: 'Code', value: (r) => r.companyCode ?? '' },
    {
      header: 'Allocated PKR',
      value: (r) => Math.round(r.allocatedPkr).toLocaleString(),
      align: 'right',
    },
    {
      header: 'Allocated USD',
      value: (r) => Math.round(r.allocatedUsd).toLocaleString(),
      align: 'right',
    },
    {
      header: 'PKR equivalent',
      value: (r) => Math.round(r.pkrEquivalent).toLocaleString(),
      align: 'right',
    },
    {
      header: 'Employees',
      value: (r) => r.employeeCount,
      align: 'right',
    },
  ];

  const handleCsv = () => {
    downloadCsv(`cost-by-company_${asOf}.csv`, rows, columns);
  };

  const handlePdf = () => {
    openPrintReport({
      title: 'Cost by Company',
      subtitle: `Active salary allocation`,
      period: `As of ${asOf}`,
      rows,
      columns,
      totals: totals
        ? [
            { label: 'Total PKR allocated', value: `PKR ${Math.round(totals.pkr).toLocaleString()}` },
            { label: 'Total USD allocated', value: `USD ${Math.round(totals.usd).toLocaleString()}` },
            {
              label: 'Total (PKR equivalent)',
              value: `PKR ${Math.round(totals.pkrEquivalent).toLocaleString()}`,
            },
            { label: 'FX rate used', value: `1 USD = ${totals.fxRate} PKR` },
          ]
        : undefined,
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
          People · Compensation · Cost by Company
        </div>
        <h1
          className="text-[22px] font-semibold leading-tight text-core-text"
          style={{ letterSpacing: '-0.018em' }}
        >
          Cost by Company
        </h1>
        <p className="mt-[2px] max-w-[680px] text-[13px] text-core-text2">
          Active salary cost allocated per billing company, based on
          each employee's billing splits. Pick a date to see the
          allocation as of that point. Currencies are kept separate;
          the PKR-equivalent column uses the configured FX rate for
          a single at-a-glance total.
        </p>
      </div>

      {/* Date picker */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-[11.5px] font-semibold uppercase tracking-wider text-core-text3">
          As of
        </label>
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCsv}
            disabled={rows.length === 0}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            CSV
          </button>
          <button
            onClick={handlePdf}
            disabled={rows.length === 0}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            PDF
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {totals && (
        <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile
            tone="green"
            label="Total · PKR"
            value={`PKR ${Math.round(totals.pkr).toLocaleString()}`}
            meta="Allocated this date"
          />
          <KpiTile
            tone="blue"
            label="Total · USD"
            value={`USD ${Math.round(totals.usd).toLocaleString()}`}
            meta="Allocated this date"
          />
          <KpiTile
            tone="violet"
            label="PKR equivalent"
            value={`PKR ${Math.round(totals.pkrEquivalent).toLocaleString()}`}
            meta={`USD = PKR ${totals.fxRate}`}
          />
          <KpiTile
            tone="amber"
            label="Unallocated"
            value={
              totals.unallocatedPkr || totals.unallocatedUsd
                ? [
                    totals.unallocatedPkr
                      ? `PKR ${Math.round(totals.unallocatedPkr).toLocaleString()}`
                      : null,
                    totals.unallocatedUsd
                      ? `USD ${Math.round(totals.unallocatedUsd).toLocaleString()}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '—'
            }
            meta="Splits don't cover 100%"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      <Card
        title="By company"
        subtitle={
          loading
            ? 'Computing…'
            : `${rows.length} ${rows.length === 1 ? 'company' : 'companies'} with allocated cost`
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-[12.5px]"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr className="bg-core-surface2">
                {[
                  'Company',
                  'Allocated PKR',
                  'Allocated USD',
                  'PKR equivalent',
                  'Employees',
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
                  <td colSpan={5} className="py-8 text-center text-core-text3">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-core-text3"
                  >
                    No allocations on this date.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isLast = i === rows.length - 1;
                  const isUnallocated = r.companyId == null;
                  return (
                    <tr
                      key={`${r.companyId ?? 'unallocated'}`}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid #E5E8DD',
                      }}
                      className={
                        isUnallocated
                          ? 'bg-core-amberSoft/40'
                          : 'hover:bg-core-surface2'
                      }
                    >
                      <td className="px-[12px] py-[8px]">
                        <div className="font-medium text-core-text">
                          {r.companyName}
                        </div>
                        {r.companyCode && (
                          <div className="mt-[1px] font-mono text-[10.5px] text-core-text3">
                            {r.companyCode}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono">
                        {r.allocatedPkr > 0 ? (
                          <span className="text-core-text">
                            PKR {Math.round(r.allocatedPkr).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono">
                        {r.allocatedUsd > 0 ? (
                          <span className="text-core-text">
                            USD {Math.round(r.allocatedUsd).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono font-semibold text-core-text">
                        PKR {Math.round(r.pkrEquivalent).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-text2">
                        {r.employeeCount}
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

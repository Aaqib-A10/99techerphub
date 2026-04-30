'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Row {
  id: number;
  empCode: string;
  name: string;
  designation: string;
  responsibilities: string | null;
  photoUrl: string | null;
  departmentId: number | null;
  departmentName: string | null;
  marketplaceIds: number[];
  marketplaceNames: string[];
}

interface Props {
  rows: Row[];
  marketplaces: { id: number; name: string }[];
  departments: { id: number; name: string }[];
}

export default function ResponsibilitiesClient({ rows, marketplaces, departments }: Props) {
  const [query, setQuery] = useState('');
  const [deptId, setDeptId] = useState<number | 'all'>('all');
  const [mpId, setMpId] = useState<number | 'all'>('all');
  const [onlyWithDuties, setOnlyWithDuties] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptId !== 'all' && r.departmentId !== deptId) return false;
      if (mpId !== 'all' && !r.marketplaceIds.includes(mpId as number)) return false;
      if (onlyWithDuties && !r.responsibilities?.trim()) return false;
      if (!q) return true;
      const hay = `${r.name} ${r.empCode} ${r.designation} ${r.departmentName ?? ''} ${r.responsibilities ?? ''} ${r.marketplaceNames.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, deptId, mpId, onlyWithDuties]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, empCode, designation, duties, marketplace…"
          className="h-9 w-full max-w-md rounded-md bg-white px-3 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <select
          value={deptId === 'all' ? 'all' : String(deptId)}
          onChange={(e) => setDeptId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="h-9 rounded-md bg-white px-2 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)]"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={mpId === 'all' ? 'all' : String(mpId)}
          onChange={(e) => setMpId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="h-9 rounded-md bg-white px-2 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)]"
        >
          <option value="all">All marketplaces</option>
          {marketplaces.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-zinc-700 select-none">
          <input
            type="checkbox"
            checked={onlyWithDuties}
            onChange={(e) => setOnlyWithDuties(e.target.checked)}
            className="h-4 w-4"
          />
          With duties only
        </label>
        <div className="ml-auto text-[12px] text-zinc-500 tabular-nums">
          <span className="font-semibold text-zinc-900">{filtered.length}</span>
          <span className="text-zinc-400"> / {rows.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg ring-1 ring-[rgba(228,228,231,0.85)] bg-white">
        <table className="min-w-full text-[13px]">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Person</th>
              <th className="text-left font-semibold px-3 py-2">Department</th>
              <th className="text-left font-semibold px-3 py-2">Designation</th>
              <th className="text-left font-semibold px-3 py-2 w-1/3">Responsibilities</th>
              <th className="text-left font-semibold px-3 py-2">Marketplaces</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">No matches.</td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50/60">
                <td className="px-3 py-2 align-top">
                  <Link href={`/employees/${r.id}`} className="flex items-center gap-2 text-zinc-900 hover:text-blue-700">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-semibold text-zinc-600 overflow-hidden">
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(r.name)
                      )}
                    </span>
                    <span>
                      <div className="font-medium leading-tight">{r.name}</div>
                      <div className="text-[11px] text-zinc-500 leading-tight">{r.empCode}</div>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 align-top text-zinc-700">{r.departmentName ?? '—'}</td>
                <td className="px-3 py-2 align-top text-zinc-700">{r.designation}</td>
                <td className="px-3 py-2 align-top text-zinc-700">
                  {r.responsibilities?.trim()
                    ? <span className="whitespace-pre-wrap">{r.responsibilities}</span>
                    : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.marketplaceNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.marketplaceNames.map((n) => (
                        <span key={n} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 px-2 py-0.5 text-[11px] font-medium">
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

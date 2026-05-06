'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Avi, Tag } from '@/app/components/design';

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

export default function ResponsibilitiesClient({
  rows,
  marketplaces,
  departments,
}: Props) {
  const router = useRouter();
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

  const selectClasses =
    'h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2 focus:border-core-text/30 focus:outline-none';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, empCode, designation, duties, marketplace…"
          className="h-9 w-full max-w-md rounded-lg border border-core-border bg-core-surface px-3 text-[12.5px] text-core-text placeholder:text-core-text3 focus:border-core-text/30 focus:outline-none"
        />
        <select
          value={deptId === 'all' ? 'all' : String(deptId)}
          onChange={(e) =>
            setDeptId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className={selectClasses}
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={mpId === 'all' ? 'all' : String(mpId)}
          onChange={(e) =>
            setMpId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className={selectClasses}
        >
          <option value="all">All marketplaces</option>
          {marketplaces.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="flex select-none items-center gap-1.5 text-[12px] text-core-text2">
          <input
            type="checkbox"
            checked={onlyWithDuties}
            onChange={(e) => setOnlyWithDuties(e.target.checked)}
            className="h-4 w-4"
            style={{ accentColor: '#1F2320' }}
          />
          With duties only
        </label>
        <div className="ml-auto text-[12px] text-core-text3 tabular-nums">
          <span className="font-semibold text-core-text">{filtered.length}</span>
          <span className="text-core-text3"> / {rows.length}</span>
        </div>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Person', 'Department', 'Designation', 'Responsibilities', 'Marketplaces'].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-[14px] py-12 text-center text-core-text3">
                    No matches.
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const isLast = i === filtered.length - 1;
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/employees/${r.id}`)}
                    className="cursor-pointer transition-colors hover:bg-core-surface2"
                    style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                  >
                    <td className="px-[14px] py-[10px] align-top">
                      <div className="flex items-center gap-[10px]">
                        <Avi
                          seed={r.empCode}
                          initials={initials(r.name)}
                          size={28}
                          photoUrl={r.photoUrl}
                        />
                        <span className="min-w-0">
                          <div className="font-medium leading-tight text-core-text">
                            {r.name}
                          </div>
                          <div className="mt-[1px] font-mono text-[10.5px] text-core-text3">
                            {r.empCode}
                          </div>
                        </span>
                      </div>
                    </td>
                    <td className="px-[14px] py-[10px] align-top text-core-text2">
                      {r.departmentName ?? <span className="text-core-text3">—</span>}
                    </td>
                    <td className="px-[14px] py-[10px] align-top text-core-text2">
                      {r.designation}
                    </td>
                    <td className="px-[14px] py-[10px] align-top text-core-text2">
                      {r.responsibilities?.trim() ? (
                        <span className="whitespace-pre-wrap">{r.responsibilities}</span>
                      ) : (
                        <span className="text-core-text3">—</span>
                      )}
                    </td>
                    <td className="px-[14px] py-[10px] align-top">
                      {r.marketplaceNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.marketplaceNames.map((n) => (
                            <Tag key={n}>{n}</Tag>
                          ))}
                        </div>
                      ) : (
                        <span className="text-core-text3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

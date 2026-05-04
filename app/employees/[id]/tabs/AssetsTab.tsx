'use client';

import Link from 'next/link';
import { formatTenureMonthsFirst } from '@/lib/tenure';
import { KpiTile, Badge, Tag } from '@/app/components/design';

interface AssetAssignment {
  id: number;
  assignedDate: Date | string;
  returnedDate: Date | string | null;
  asset: {
    id: number;
    assetTag: string;
    manufacturer: string;
    model: string;
    category: { name: string };
  };
}

interface Props {
  assetAssignments: AssetAssignment[];
  /** Whether to show the "+ Assign Asset" affordance — only for active employees. */
  isActive: boolean;
}

export default function AssetsTab({ assetAssignments, isActive }: Props) {
  const activeCount = assetAssignments.filter((a) => !a.returnedDate).length;
  const returnedCount = assetAssignments.filter((a) => a.returnedDate).length;
  const uniqueActiveCategories = new Set(
    assetAssignments
      .filter((a) => !a.returnedDate)
      .map((a) => a.asset?.category?.name)
      .filter(Boolean),
  ).size;

  return (
    <>
      {/* Asset summary strip — design-system tinted tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile tone="green" label="Active" value={activeCount} meta="Currently held" />
        <KpiTile tone="rose" label="Returned" value={returnedCount} meta="Closed assignments" />
        <KpiTile
          tone="blue"
          label="Total Ever"
          value={assetAssignments.length}
          meta="Lifetime assignments"
        />
        <KpiTile
          tone="violet"
          label="Categories"
          value={uniqueActiveCategories}
          meta="Unique types active"
        />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="section-heading">Assignment History ({activeCount} active)</h3>
          {isActive && (
            <Link href={`/assets?assignment=unassigned`} className="btn btn-sm btn-primary">
              + Assign Asset
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Asset Tag', 'Category', 'Model', 'Assigned Date', 'Returned Date', 'Duration', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assetAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-[14px] py-12 text-center text-core-text3">
                    No assets assigned
                  </td>
                </tr>
              ) : (
                assetAssignments.map((a, idx) => {
                  const isLast = idx === assetAssignments.length - 1;
                  const start = new Date(a.assignedDate).getTime();
                  const end = a.returnedDate ? new Date(a.returnedDate).getTime() : Date.now();
                  const days = Math.max(
                    1,
                    Math.floor((end - start) / (1000 * 60 * 60 * 24)),
                  );
                  return (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-core-surface2"
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                    >
                      <td className="px-[14px] py-3">
                        <Link href={`/assets/${a.asset.id}`} className="hover:underline">
                          <Tag>{a.asset.assetTag}</Tag>
                        </Link>
                      </td>
                      <td className="px-[14px] py-3 text-core-text2">{a.asset.category.name}</td>
                      <td className="px-[14px] py-3 text-core-text">
                        {a.asset.manufacturer} {a.asset.model}
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                        {new Date(a.assignedDate).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                        {a.returnedDate ? (
                          new Date(a.returnedDate).toLocaleDateString()
                        ) : (
                          <span className="text-core-text3">—</span>
                        )}
                      </td>
                      <td className="px-[14px] py-3 text-core-text2">
                        {formatTenureMonthsFirst(days)}
                      </td>
                      <td className="px-[14px] py-3">
                        {a.returnedDate ? (
                          <Badge tone="gray">Returned</Badge>
                        ) : (
                          <Badge tone="green">Active</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

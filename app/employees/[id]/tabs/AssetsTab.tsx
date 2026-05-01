'use client';

import Link from 'next/link';
import { formatTenureMonthsFirst } from '@/lib/tenure';

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
      {/* Asset summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Active" value={activeCount} sub="Currently held" />
        <SummaryCard label="Returned" value={returnedCount} sub="Closed assignments" />
        <SummaryCard
          label="Total Ever"
          value={assetAssignments.length}
          sub="Lifetime assignments"
        />
        <SummaryCard
          label="Categories"
          value={uniqueActiveCategories}
          sub="Unique types active"
        />
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="section-heading">
            Assignment History ({activeCount} active)
          </h3>
          {isActive && (
            <Link href={`/assets?assignment=unassigned`} className="btn btn-sm btn-primary">
              + Assign Asset
            </Link>
          )}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Category</th>
                <th>Model</th>
                <th>Assigned Date</th>
                <th>Returned Date</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assetAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-core-text3">
                    No assets assigned
                  </td>
                </tr>
              ) : (
                assetAssignments.map((a) => {
                  const start = new Date(a.assignedDate).getTime();
                  const end = a.returnedDate
                    ? new Date(a.returnedDate).getTime()
                    : Date.now();
                  const days = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
                  return (
                    <tr key={a.id}>
                      <td className="font-mono text-sm">
                        <Link
                          href={`/assets/${a.asset.id}`}
                          className="text-core-text2 hover:underline"
                        >
                          {a.asset.assetTag}
                        </Link>
                      </td>
                      <td>{a.asset.category.name}</td>
                      <td>
                        {a.asset.manufacturer} {a.asset.model}
                      </td>
                      <td>{new Date(a.assignedDate).toLocaleDateString()}</td>
                      <td>
                        {a.returnedDate
                          ? new Date(a.returnedDate).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="text-sm text-core-text2">
                        {formatTenureMonthsFirst(days)}
                      </td>
                      <td>
                        <span
                          className={`badge ${a.returnedDate ? 'badge-gray' : 'badge-green'}`}
                        >
                          {a.returnedDate ? 'Returned' : 'Active'}
                        </span>
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

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-core-text3 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-core-text">{value}</div>
        <div className="text-xs text-core-text3">{sub}</div>
      </div>
    </div>
  );
}
